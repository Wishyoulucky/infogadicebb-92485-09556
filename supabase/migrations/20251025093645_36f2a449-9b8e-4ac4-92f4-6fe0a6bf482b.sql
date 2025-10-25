-- Create storage bucket for product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for product images
CREATE POLICY "Product images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can upload product images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'product-images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update product images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'product-images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete product images"
ON storage.objects FOR DELETE
USING (bucket_id = 'product-images' AND auth.role() = 'authenticated');

-- Create products table
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  description TEXT,
  box_set_info TEXT,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Products policies (public read, authenticated write)
CREATE POLICY "Anyone can view products"
ON public.products FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can insert products"
ON public.products FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update products"
ON public.products FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete products"
ON public.products FOR DELETE
USING (auth.role() = 'authenticated');

-- Create orders table
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_address TEXT NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Orders policies (authenticated users can manage)
CREATE POLICY "Authenticated users can view all orders"
ON public.orders FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Anyone can create orders"
ON public.orders FOR INSERT
WITH CHECK (true);

CREATE POLICY "Authenticated users can update orders"
ON public.orders FOR UPDATE
USING (auth.role() = 'authenticated');

-- Create order_items table
CREATE TABLE public.order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on order_items
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Order items policies
CREATE POLICY "Authenticated users can view order items"
ON public.order_items FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Anyone can create order items"
ON public.order_items FOR INSERT
WITH CHECK (true);

-- Insert sample blind box products
INSERT INTO public.products (name, price, description, box_set_info, stock_quantity, image_url)
VALUES 
  ('Mystery Mini Figure Series 1', 299.00, 'คอลเลกชันฟิกเกอร์มินิสุ่ม ดีไซน์มินิมอลสไตล์ญี่ปุ่น', '1 box set มี 12 แบบ สุ่มได้ 1 จาก 12 แบบ (มี Secret 1 แบบ)', 50, null),
  ('Zen Garden Blind Box', 399.00, 'ชุดตกแต่งสวนเซ็นขนาดจิ๋ว แต่ละกล่องสุ่มได้ต่างกัน', '1 box set มี 8 แบบ สุ่มได้ 1 จาก 8 แบบ', 35, null),
  ('Minimal Animal Series', 249.00, 'ตุ๊กตาสัตว์น้อยสไตล์มินิมอล สีพาสเทลอ่อนๆ', '1 box set มี 10 แบบ สุ่มได้ 1 จาก 10 แบบ (มี Hidden 2 แบบ)', 60, null);