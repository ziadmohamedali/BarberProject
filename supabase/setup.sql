-- HADAD database setup.
-- Run once in the Supabase SQL Editor. Create the owner in Supabase Auth,
-- then run the separate owner-claim SQL documented in README.md.

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

create or replace function public.is_hadad_owner()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'hadad_owner') = 'true', false);
$$;

revoke all on function public.is_hadad_owner() from public;
grant execute on function public.is_hadad_owner() to anon, authenticated;

do $$
declare
  policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public' and tablename in ('products', 'bookings')
  loop
    execute format('drop policy if exists %I on %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  end loop;
end;
$$;

alter table public.products enable row level security;
alter table public.bookings enable row level security;

revoke all privileges on table public.products from public, anon, authenticated;
grant select on table public.products to anon, authenticated;
grant insert, update, delete on table public.products to authenticated;

create policy "public read active HADAD products"
on public.products for select to anon, authenticated
using (active or public.is_hadad_owner());

create policy "owner manages HADAD products"
on public.products for all to authenticated
using (public.is_hadad_owner())
with check (public.is_hadad_owner());

revoke all privileges on table public.bookings from public, anon, authenticated;
grant select, update, delete on table public.bookings to authenticated;

create policy "owner manages HADAD bookings"
on public.bookings for all to authenticated
using (public.is_hadad_owner())
with check (public.is_hadad_owner());

create or replace function public.create_hadad_booking(
  p_customer_name text,
  p_whatsapp text,
  p_email text,
  p_product_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_product_count integer;
  v_total bigint;
  v_products jsonb;
  v_booking_id uuid;
  v_deposit constant integer := 50;
begin
  if p_customer_name is null or char_length(btrim(p_customer_name)) not between 1 and 80 then
    raise exception 'Enter a name between 1 and 80 characters.';
  end if;
  if p_whatsapp is null or char_length(regexp_replace(p_whatsapp, '[^0-9]', '', 'g')) not between 8 and 15 then
    raise exception 'Enter a valid WhatsApp number.';
  end if;
  if p_email is null or p_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a valid email address.';
  end if;
  if p_product_ids is null or cardinality(p_product_ids) = 0 then
    raise exception 'Select at least one active product.';
  end if;
  if (select count(distinct product_id) from unnest(p_product_ids) as selected(product_id)) <> cardinality(p_product_ids) then
    raise exception 'A product can only be selected once.';
  end if;

  select count(*), coalesce(sum(product.price), 0),
         coalesce(jsonb_agg(jsonb_build_object(
           'product_id', product.id,
           'title', product.title,
           'price', product.price
         ) order by product.sort_order, product.created_at), '[]'::jsonb)
    into v_product_count, v_total, v_products
    from public.products as product
   where product.id = any(p_product_ids) and product.active = true;

  if v_product_count <> cardinality(p_product_ids) then
    raise exception 'One or more selected services are unavailable. Refresh and select again.';
  end if;
  if v_total < v_deposit then
    raise exception 'Selected services must total at least %.', v_deposit;
  end if;
  if v_total > 2147483647 then
    raise exception 'Selected services total is too large.';
  end if;

  insert into public.bookings (
    customer_name, whatsapp, email, products, total, deposit, remaining
  ) values (
    btrim(p_customer_name), btrim(p_whatsapp), btrim(p_email), v_products,
    v_total::integer, v_deposit, (v_total - v_deposit)::integer
  ) returning id into v_booking_id;

  return v_booking_id;
end;
$$;

revoke all on function public.create_hadad_booking(text, text, text, uuid[]) from public;
grant execute on function public.create_hadad_booking(text, text, text, uuid[]) to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public can read HADAD product images" on storage.objects;
drop policy if exists "public can upload HADAD product images" on storage.objects;
drop policy if exists "public can update HADAD product images" on storage.objects;
drop policy if exists "public can delete HADAD product images" on storage.objects;
drop policy if exists "HADAD public image read" on storage.objects;
drop policy if exists "HADAD owner image upload" on storage.objects;
drop policy if exists "HADAD owner image update" on storage.objects;
drop policy if exists "HADAD owner image delete" on storage.objects;

create policy "HADAD public image read"
on storage.objects for select to public
using (bucket_id = 'product-images');

create policy "HADAD owner image upload"
on storage.objects for insert to authenticated
with check (bucket_id = 'product-images' and public.is_hadad_owner());

create policy "HADAD owner image update"
on storage.objects for update to authenticated
using (bucket_id = 'product-images' and public.is_hadad_owner())
with check (bucket_id = 'product-images' and public.is_hadad_owner());

create policy "HADAD owner image delete"
on storage.objects for delete to authenticated
using (bucket_id = 'product-images' and public.is_hadad_owner());
