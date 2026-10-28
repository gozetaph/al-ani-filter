-- ==========================================================
-- AL ANI Filter (العاني للفلتر) - Complete Supabase Setup
-- ==========================================================

-- 1. Enable UUID extension
create extension if not exists "uuid-ossp";

-- 2. Storage Bucket for Product Photos
-- This creates a dedicated public bucket to hold all product images
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

-- Storage policies: Anyone can view images, anyone can upload images
create policy "Public Access to Product Images"
on storage.objects for select
using (bucket_id = 'product-images');

create policy "Allow Uploads to Product Images"
on storage.objects for insert
with check (bucket_id = 'product-images');

create policy "Allow Updates on Product Images"
on storage.objects for update
using (bucket_id = 'product-images');

-- 3. Shipping Zones (Iraq Governorates)
create table if not exists public.shipping_zones (
  id serial primary key,
  governorate text unique not null,
  governorate_ar text not null,
  delivery_fee integer not null default 5000 -- in IQD
);

insert into public.shipping_zones (governorate, governorate_ar, delivery_fee) values
  ('Baghdad', 'بغداد', 5000),
  ('Erbil', 'أربيل', 6000),
  ('Basra', 'البصرة', 7000),
  ('Sulaymaniyah', 'السليمانية', 6000),
  ('Najaf', 'النجف الأشرف', 7000),
  ('Karbala', 'كربلاء المقدسة', 7000),
  ('Babil', 'بابل / الحلة', 7000),
  ('Kirkuk', 'كركوك', 6000),
  ('Nineveh', 'نينوى / الموصل', 7000),
  ('Anbar', 'الأنبار', 7000),
  ('Diyala', 'ديالى', 7000),
  ('Wasit', 'واسط / الكوت', 7000),
  ('Dhi Qar', 'ذي قار / الناصرية', 7000),
  ('Maysan', 'ميسان / العمارة', 7000),
  ('Muthanna', 'المثنى / السماوة', 7000),
  ('Qadisiyyah', 'القادسية / الديوانية', 7000),
  ('Salah al-Din', 'صلاح الدين / تكريت', 7000),
  ('Duhok', 'دهوك', 7000)
on conflict (governorate) do update
set delivery_fee = excluded.delivery_fee, governorate_ar = excluded.governorate_ar;

-- 4. Products Table
create table if not exists public.products (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  slug text unique not null,
  type text default 'منظومات R.O' not null,
  description text,
  price integer not null, -- Price in IQD
  stock_quantity integer default 0 not null,
  image_url text not null,
  is_active boolean default true not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Seed Initial Products
insert into public.products (title, slug, type, description, price, stock_quantity, image_url) values
  (
    'منظومة تحلية مياه 7 مراحل R.O',
    'ro-system-7-stage',
    'منظومات R.O',
    'نظام التناضح العكسي المتكامل مع خزان ضغط 12 لتر، صنبور ستانلس ومضخة كورية صامتة مع كفالة سنة كاملة.',
    185000,
    12,
    '/products/ro-system.jpg'
  ),
  (
    'طقم شمعات 3 مراحل أولى Filter Max',
    'filter-max-3-stage-set',
    'شمعات تبديل',
    'مرحلة أولى بولي بروبلين 5 مايكرون + كربون نشط حبيبي + كربون صلب لإزالة الشوائب والرائحة والكلور.',
    15000,
    45,
    '/products/cartridges.png'
  ),
  (
    'ممبرين تحلية تايواني Vontron 75GPD',
    'vontron-ro-membrane-75gpd',
    'الممبرين والمضخات',
    'غشاء التناضح العكسي عالي الدقة لعزل الأملاح الذائبة والمعادن الثقيلة بنسبة تصل إلى 98%.',
    25000,
    6,
    '/products/membrane.png'
  ),
  (
    'مضخة ماء كورية للمنظومات المنزلية 24V',
    'ro-booster-pump-24v',
    'الممبرين والمضخات',
    'مضخة ضغط قوية صامتة ومحول كهربائي أصلي تتحمل ضغط الاستخدام المستمر في العراق.',
    35000,
    18,
    '/products/pump.png'
  ),
  (
    'جهاز فحص نسبة الأملاح الرقمي TDS Meter',
    'digital-tds-meter',
    'أجهزة وملحقات',
    'لقياس نقاوة المياه والأملاح الذائبة في ثوانٍ معدودة بدقة متناهية وشاشة رقمية واضحة.',
    18000,
    9,
    '/products/tds-meter.png'
  )
on conflict (slug) do nothing;

-- 5. Orders Table
create table if not exists public.orders (
  id text primary key, -- e.g. AF-1092
  customer_name text not null,
  phone text not null,
  governorate text not null,
  detailed_address text not null,
  payment_method text default 'COD' check (payment_method in ('COD', 'ONLINE')),
  subtotal integer not null,
  shipping_fee integer not null,
  total_amount integer not null,
  status text default 'pending' check (status in ('pending', 'confirmed', 'dispatched', 'delivered', 'cancelled')),
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. Order Line Items
create table if not exists public.order_items (
  id uuid default gen_random_uuid() primary key,
  order_id text references public.orders(id) on delete cascade not null,
  product_id uuid references public.products(id) not null,
  quantity integer not null,
  unit_price integer not null
);

-- 7. Row-Level Security
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.shipping_zones enable row level security;

create policy "Allow read on products" on public.products for select using (true);
create policy "Allow insert on products" on public.products for insert with check (true);
create policy "Allow update on products" on public.products for update using (true);

create policy "Allow read on shipping_zones" on public.shipping_zones for select using (true);

create policy "Allow insert on orders" on public.orders for insert with check (true);
create policy "Allow read on orders" on public.orders for select using (true);
create policy "Allow update on orders" on public.orders for update using (true);

create policy "Allow insert on order_items" on public.order_items for insert with check (true);
create policy "Allow read on order_items" on public.order_items for select using (true);
