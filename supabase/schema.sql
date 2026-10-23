-- ==========================================================
-- AL ANI Filter (العاني للفلتر) - Supabase PostgreSQL Schema
-- ==========================================================

-- 1. Enable UUID Extension
create extension if not exists "uuid-ossp";

-- 2. Shipping Zones Table (Iraq Governorates)
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

-- 3. Products Table
create table if not exists public.products (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  slug text unique not null,
  description text,
  category text not null check (category in ('systems', 'cartridges', 'parts')),
  price integer not null, -- Price in IQD
  stock_quantity integer default 0 not null,
  image_url text not null,
  badge text,
  is_active boolean default true not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Seed Products with the User's uploaded images
insert into public.products (title, slug, description, category, price, stock_quantity, image_url, badge) values
  (
    'منظومة فلتر تحلية 7 مراحل R.O الأصلية',
    'ro-system-7-stage',
    'نظام التناضح العكسي المتكامل، يشمل خزان ضغط سعة 12 لتر، صنبور ستانلس ستيل ومضخة كورية صامتة وكفالة سنة كاملة.',
    'systems',
    185000,
    12,
    '/products/ro-system.jpg',
    'الأكثر طلباً'
  ),
  (
    'سيت شمعات 3 مراحل أولى أصلي Filter Max',
    'filter-max-3-stage-set',
    'مرحلة أولى بولي بروبلين 5 مايكرون + كربون حبيبي + كربون صلب لإزالة الشوائب والطعم والكلور والرائحة.',
    'cartridges',
    15000,
    45,
    '/products/cartridges.png',
    'تبديل دوري'
  ),
  (
    'ممبرين تحلية تايواني Vontron أصلي 75 غالون',
    'vontron-ro-membrane-75gpd',
    'غشاء التناضح العكسي عالي الدقة لعزل الأملاح الذائبة والمعادن الثقيلة والملوثات بنسبة تصل إلى 98%.',
    'cartridges',
    25000,
    5,
    '/products/membrane.png',
    'شبه نافد'
  ),
  (
    'مضخة ماء كورية للمنظومات المنزلية 24V',
    'ro-booster-pump-24v',
    'مضخة ضغط ماء قوية وصامتة مع محول كهربائي أصلي، مصممة لتحمل العمل الشاق والمستمر في ظروف العراق.',
    'parts',
    35000,
    18,
    '/products/pump.png',
    'قطع غيار'
  ),
  (
    'جهاز فحص نسبة الأملاح الرقمي (TDS Meter)',
    'digital-tds-meter',
    'لقياس نقاوة المياه والأملاح الذائبة في ثوانٍ معدودة بدقة متناهية مع شاشة رقمية وحافظة أصلية.',
    'parts',
    18000,
    8,
    '/products/tds-meter.png',
    'فحص جودة'
  )
on conflict (slug) do nothing;

-- 4. Orders Table
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

-- 5. Order Line Items Table
create table if not exists public.order_items (
  id uuid default gen_random_uuid() primary key,
  order_id text references public.orders(id) on delete cascade not null,
  product_id uuid references public.products(id) not null,
  quantity integer not null,
  unit_price integer not null
);

-- 6. Row-Level Security (RLS)
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.shipping_zones enable row level security;

-- Public can read products and shipping zones
create policy "Public can view active products" on public.products for select using (is_active = true);
create policy "Public can view shipping zones" on public.shipping_zones for select using (true);

-- Anyone (customers) can create an order and order items
create policy "Anyone can insert orders" on public.orders for insert with check (true);
create policy "Anyone can insert order items" on public.order_items for insert with check (true);

-- Authenticated admins can view and update all orders & products
create policy "Allow all actions for service role and admin" on public.orders for all using (true);
create policy "Allow all actions on products for admin" on public.products for all using (true);
