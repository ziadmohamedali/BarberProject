-- Bootstrap the current product schema on a new, empty Supabase project.
-- Apply before 003_hadad_live_integration.sql. Do not run on the old project.

begin;

create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 30),
  description text not null default '' check (char_length(btrim(description)) > 0),
  category text not null check (category in ('haircut', 'package')),
  price numeric(10, 2) not null check (price > 0 and price = trunc(price)),
  old_price numeric(10, 2)
    check (old_price is null or (old_price > price and old_price = trunc(old_price))),
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  image_url text,
  gallery_images text[] not null default '{}'
    check (cardinality(gallery_images) <= 4),
  is_active boolean not null default true,
  display_order integer not null default 0 check (display_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_display_order_idx
  on public.products (category, display_order, created_at);

alter table public.products enable row level security;
revoke all privileges on table public.products from public, anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

commit;
