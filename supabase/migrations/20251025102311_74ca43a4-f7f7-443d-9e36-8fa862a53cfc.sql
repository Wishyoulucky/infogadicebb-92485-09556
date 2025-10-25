-- Add product_flag enum
CREATE TYPE public.product_flag AS ENUM ('in-stock', 'preorder', 'presale');

-- Add fields to products table for options support
ALTER TABLE public.products
ADD COLUMN base_price NUMERIC,
ADD COLUMN has_options BOOLEAN DEFAULT FALSE,
ADD COLUMN options_stock_total INTEGER DEFAULT 0,
ADD COLUMN product_flag product_flag DEFAULT 'in-stock',
ADD COLUMN eta_date TIMESTAMP WITH TIME ZONE;

-- Update existing products: set base_price to current price
UPDATE public.products SET base_price = price WHERE base_price IS NULL;

-- Create product_options table
CREATE TABLE public.product_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  image_url TEXT,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  price_delta NUMERIC DEFAULT 0,
  discount_price NUMERIC,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT check_stock_non_negative CHECK (stock_quantity >= 0)
);

-- Enable RLS on product_options
ALTER TABLE public.product_options ENABLE ROW LEVEL SECURITY;

-- Anyone can view product options
CREATE POLICY "Anyone can view product options"
ON public.product_options FOR SELECT
USING (true);

-- Authenticated users can insert product options
CREATE POLICY "Authenticated users can insert product options"
ON public.product_options FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- Authenticated users can update product options
CREATE POLICY "Authenticated users can update product options"
ON public.product_options FOR UPDATE
USING (auth.role() = 'authenticated');

-- Authenticated users can delete product options
CREATE POLICY "Authenticated users can delete product options"
ON public.product_options FOR DELETE
USING (auth.role() = 'authenticated');

-- Add tracking_number to orders
ALTER TABLE public.orders
ADD COLUMN tracking_number TEXT;

-- Add option fields to order_items
ALTER TABLE public.order_items
ADD COLUMN option_id UUID REFERENCES public.product_options(id) ON DELETE SET NULL,
ADD COLUMN option_label TEXT,
ADD COLUMN option_sku TEXT,
ADD COLUMN option_image TEXT;

-- Create index for performance
CREATE INDEX idx_product_options_product_id ON public.product_options(product_id);
CREATE INDEX idx_product_options_sku ON public.product_options(sku);

-- Function to update product options summary
CREATE OR REPLACE FUNCTION public.update_product_options_summary()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_stock INTEGER;
  has_opts BOOLEAN;
BEGIN
  -- Calculate total stock and check if options exist
  SELECT 
    COALESCE(SUM(stock_quantity), 0),
    COUNT(*) > 0
  INTO total_stock, has_opts
  FROM public.product_options
  WHERE product_id = COALESCE(NEW.product_id, OLD.product_id);

  -- Update the product
  UPDATE public.products
  SET 
    options_stock_total = total_stock,
    has_options = has_opts
  WHERE id = COALESCE(NEW.product_id, OLD.product_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger to update product summary when options change
CREATE TRIGGER trigger_update_product_options_summary
AFTER INSERT OR UPDATE OR DELETE ON public.product_options
FOR EACH ROW
EXECUTE FUNCTION public.update_product_options_summary();

-- Insert admin roles for specified users
INSERT INTO public.user_roles (user_id, role)
SELECT 
  au.id,
  'admin'::app_role
FROM auth.users au
WHERE au.email IN ('gadsarin.sukbunthong@gmail.com', 'wishyouluckyshop@gmail.com')
ON CONFLICT (user_id, role) DO NOTHING;