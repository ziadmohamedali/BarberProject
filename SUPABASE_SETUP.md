# HADAD Supabase setup and security

## 1. Configure the app

Set the Supabase **Project URL** and **public anon/publishable key** in the root `.env.local`:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
```

Only the public URL and public anon/publishable key belong in frontend configuration. Never place a service-role key, database password, or other secret in a `VITE_` variable.

## 2. Create the database and storage policies

In the Supabase SQL Editor, apply these files in order:

1. `supabase/migrations/001_hadad_schema.sql`
2. `supabase/migrations/002_hadad_security.sql`

For an existing project that already ran the earlier schema migration, apply `002_hadad_security.sql` to replace the old permissive policies.

The project has only the `products` and `bookings` tables, plus the `product-images` Storage bucket. The security migration removes the old permissive MVP policies, enables RLS, and sets these rules:

- Public visitors can read active products; only an authenticated owner can manage products.
- Customers can submit bookings through `create_hadad_booking`; booking details are readable/manageable only by the owner.
- The booking function accepts product IDs, looks up active products, and calculates the title/price snapshots, total, fixed 50 EGP deposit, and remaining balance itself. Direct client inserts and customer reads/updates/deletes are not granted.
- Product images are publicly viewable. Only the authenticated owner can upload, replace, or delete them. The bucket restricts uploads to JPEG, PNG, WebP, and GIF, up to 5 MB.

Products have integer prices and optional duration in minutes. Packages can use a required main image and up to four additional images; haircuts cannot have extra images.

## 3. Create and authorize the owner account

The dashboard uses Supabase Auth; a browser-side static password is not an authorization mechanism. Create the owner's email/password user in **Supabase Dashboard → Authentication → Users**. In the SQL Editor, mark that exact account as the owner (replace the email):

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || '{"hadad_owner": true}'::jsonb
where email = 'owner@example.com';
```

Confirm the update affected exactly the intended owner account. Sign out and back in after changing the claim so the user's JWT includes `app_metadata.hadad_owner = true`. The RLS policies check this server-issued app metadata; user-editable profile metadata is not used for authorization. Do not expose Supabase admin credentials in the app.

## 4. Product images and booking behavior

The owner dashboard uses file inputs to upload a main image and optional package gallery images to Storage, then saves their public URLs with the product. The database also validates required text, integer prices, supported categories, and image-count limits.

Customers only submit their contact information and selected product IDs. The database RPC rejects invalid contact data, duplicate or inactive product IDs, and totals below the 50 EGP deposit. It creates the product snapshots and all totals from current database prices, rather than trusting values sent by the browser.

Bookings retain the product title and price snapshots even if a product is later edited or deleted. Hidden products stay in the database with `active = false` and are excluded from public catalog reads.

The Vercel deployment uses the root `vercel.json` rewrite to serve the React app for client-side routes such as `/dashboard`. For other hosts, enable their equivalent SPA fallback.
