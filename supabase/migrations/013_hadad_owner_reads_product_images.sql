-- Supabase Storage only removes objects the caller can also SELECT. Without this
-- policy, the owner's DELETE request succeeds but removes nothing, so replaced or
-- deleted product/hero images are left behind in the bucket. Public image URLs
-- are unaffected: the bucket is public and those reads bypass RLS.
drop policy if exists "HADAD owner reads product images" on storage.objects;

create policy "HADAD owner reads product images"
on storage.objects
for select
to authenticated
using (bucket_id = 'product-images' and public.is_hadad_owner());
