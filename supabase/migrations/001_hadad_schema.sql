-- HADAD MVP schema: products and bookings.
-- Apply this migration before 002_hadad_security.sql in the Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 30),
  description text not null check (char_length(btrim(description)) > 0),
  price integer not null check (price > 0),
  old_price integer check (old_price is null or old_price > 0),
  category text not null check (category in ('haircut', 'package')),
  active boolean not null default true,
  duration integer check (duration is null or duration > 0),
  main_image text not null check (char_length(btrim(main_image)) > 0),
  extra_images text[] not null default '{}',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_extra_images_max_four check (cardinality(extra_images) <= 4),
  constraint products_haircut_has_no_extra_images check (category = 'package' or cardinality(extra_images) = 0)
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null check (char_length(btrim(customer_name)) between 1 and 80),
  whatsapp text not null,
  email text not null,
  products jsonb not null check (jsonb_typeof(products) = 'array' and jsonb_array_length(products) > 0),
  total integer not null check (total > 0),
  deposit integer not null default 50 check (deposit = 50),
  remaining integer not null check (remaining = total - deposit and remaining >= 0),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'confirmed', 'rejected')),
  booking_status text not null default 'pending' check (booking_status in ('pending', 'confirmed', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

create or replace function public.set_hadad_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_hadad_updated_at();

alter table public.products enable row level security;
alter table public.bookings enable row level security;

-- Apply 002_hadad_security.sql next to install the owner policies, public
-- catalog access, secure booking RPC, and product-image bucket policies.
