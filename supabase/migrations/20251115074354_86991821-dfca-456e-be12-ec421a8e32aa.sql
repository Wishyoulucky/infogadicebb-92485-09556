-- Step 2: Create tables, columns, indexes and RLS policies

-- Create qr_map table
CREATE TABLE IF NOT EXISTS public.qr_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_raw TEXT NOT NULL,
  qr_hash TEXT NOT NULL UNIQUE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  option_id UUID REFERENCES public.product_options(id) ON DELETE CASCADE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qr_map_hash ON public.qr_map(qr_hash);
CREATE INDEX IF NOT EXISTS idx_qr_map_product ON public.qr_map(product_id);

-- Create stock_movements table
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  option_id UUID REFERENCES public.product_options(id) ON DELETE SET NULL,
  delta INTEGER NOT NULL,
  before_qty INTEGER NOT NULL,
  after_qty INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('scan-in','scan-out','adjust','create-by-qr','sale')),
  notes TEXT,
  admin_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON public.stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON public.stock_movements(created_at DESC);

-- Add columns to products and product_options
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS ean_code TEXT;
ALTER TABLE public.product_options ADD COLUMN IF NOT EXISTS ean_code TEXT;

CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_products_ean_code ON public.products(ean_code);
CREATE INDEX IF NOT EXISTS idx_product_options_ean_code ON public.product_options(ean_code);

-- Enable RLS
ALTER TABLE public.qr_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- Drop old policies for products
DROP POLICY IF EXISTS "Authenticated users can insert products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can update products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can delete products" ON public.products;

-- Create new policies for products
CREATE POLICY "Admins and Editors can insert products"
ON public.products FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Admins and Editors can update products"
ON public.products FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Admins and Editors can delete products"
ON public.products FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

-- Drop old policies for product_options
DROP POLICY IF EXISTS "Authenticated users can insert product options" ON public.product_options;
DROP POLICY IF EXISTS "Authenticated users can update product options" ON public.product_options;
DROP POLICY IF EXISTS "Authenticated users can delete product options" ON public.product_options;

-- Create new policies for product_options
CREATE POLICY "Admins and Editors can insert product options"
ON public.product_options FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Admins and Editors can update product options"
ON public.product_options FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Admins and Editors can delete product options"
ON public.product_options FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

-- Create policies for qr_map
CREATE POLICY "Admins and Editors can view qr_map"
ON public.qr_map FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Admins and Editors can insert qr_map"
ON public.qr_map FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Admins and Editors can update qr_map"
ON public.qr_map FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Admins and Editors can delete qr_map"
ON public.qr_map FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

-- Create policies for stock_movements
CREATE POLICY "Admins and Editors can view stock_movements"
ON public.stock_movements FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Admins and Editors can insert stock_movements"
ON public.stock_movements FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_products_created_at ON public.products(created_at DESC);
