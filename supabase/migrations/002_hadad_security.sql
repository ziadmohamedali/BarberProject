-- HADAD MVP security: public active catalog, owner-only management, safe booking RPC.
-- Apply after 001_hadad_schema.sql. Existing MVP policies are removed below.

create or replace function public.is_hadad_owner()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'hadad_owner') = 'true', false);
$$;

revoke all on function public.is_hadad_owner() from public;
grant execute on function public.is_hadad_owner() to anon, authenticated;

-- Remove legacy and unexpected policies on HADAD tables so permissive old policies
-- cannot accidentally combine with the rules below.
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

-- Customers submit selected product IDs only. Prices, titles, totals and deposit
-- are loaded/calculated here, so a browser cannot forge a cheaper booking.
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

-- The bucket is public for image reads; uploads remain owner-only. Storage also
-- enforces MIME allow-list and 5 MB maximum on the bucket itself.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Drop policy names used by the earlier insecure MVP migration.
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
