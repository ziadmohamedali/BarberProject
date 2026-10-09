-- Additive HADAD integration for the existing products table.
-- Inspected before application: products exists with the live name/image/order
-- columns, no products/storage policies exist, and public products RLS is enabled.
-- This migration does not recreate products or remove any existing policies.

create or replace function public.is_hadad_owner()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'hadad_owner') = 'true', false);
$$;

revoke all on function public.is_hadad_owner() from public;
grant execute on function public.is_hadad_owner() to anon, authenticated;

alter table public.products enable row level security;
revoke all privileges on table public.products from public, anon, authenticated;
grant select on table public.products to anon, authenticated;
grant insert, update, delete on table public.products to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'products'
      and policyname = 'HADAD public read active products'
  ) then
    create policy "HADAD public read active products"
      on public.products for select to anon, authenticated
      using (is_active or public.is_hadad_owner());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'products'
      and policyname = 'HADAD owner manages products'
  ) then
    create policy "HADAD owner manages products"
      on public.products for all to authenticated
      using (public.is_hadad_owner())
      with check (public.is_hadad_owner());
  end if;
end;
$$;

create or replace function public.touch_hadad_product_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.products'::regclass
      and tgname = 'hadad_products_updated_at'
      and not tgisinternal
  ) then
    create trigger hadad_products_updated_at
      before update on public.products
      for each row execute function public.touch_hadad_product_updated_at();
  end if;
end;
$$;

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null check (char_length(btrim(customer_name)) between 1 and 80),
  whatsapp text not null,
  email text not null,
  products jsonb not null check (jsonb_typeof(products) = 'array' and jsonb_array_length(products) > 0),
  total integer not null check (total >= 50),
  deposit integer not null default 50 check (deposit = 50),
  remaining integer not null check (remaining = total - deposit and remaining >= 0),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'confirmed', 'rejected')),
  booking_status text not null default 'pending' check (booking_status in ('pending', 'confirmed', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

alter table public.bookings enable row level security;
revoke all privileges on table public.bookings from public, anon, authenticated;
grant select, update on table public.bookings to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'bookings'
      and policyname = 'HADAD owner manages bookings'
  ) then
    create policy "HADAD owner manages bookings"
      on public.bookings for all to authenticated
      using (public.is_hadad_owner())
      with check (public.is_hadad_owner());
  end if;
end;
$$;

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
  v_total numeric;
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
           'title', product.name,
           'price', product.price
         ) order by product.display_order, product.created_at), '[]'::jsonb)
    into v_product_count, v_total, v_products
    from public.products as product
   where product.id = any(p_product_ids) and product.is_active = true;

  if v_product_count <> cardinality(p_product_ids) then
    raise exception 'One or more selected services are unavailable. Refresh and select again.';
  end if;
  if v_total < v_deposit then
    raise exception 'Selected services must total at least %.', v_deposit;
  end if;
  if v_total <> trunc(v_total) or v_total > 2147483647 then
    raise exception 'Selected services must total a supported whole-number EGP amount.';
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

-- The inspected bucket is already public and limited to JPEG/PNG/WebP at 5 MB.
-- Only add owner-claim-gated mutation policies; leave bucket configuration and
-- all other Storage policies untouched.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'HADAD owner uploads product images'
  ) then
    create policy "HADAD owner uploads product images"
      on storage.objects for insert to authenticated
      with check (bucket_id = 'product-images' and public.is_hadad_owner());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'HADAD owner updates product images'
  ) then
    create policy "HADAD owner updates product images"
      on storage.objects for update to authenticated
      using (bucket_id = 'product-images' and public.is_hadad_owner())
      with check (bucket_id = 'product-images' and public.is_hadad_owner());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'HADAD owner deletes product images'
  ) then
    create policy "HADAD owner deletes product images"
      on storage.objects for delete to authenticated
      using (bucket_id = 'product-images' and public.is_hadad_owner());
  end if;
end;
$$;
