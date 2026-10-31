# HADAD Barber Shop

A one-owner barber service catalog and booking app built with React, Vite, and Supabase.

## Supabase setup

For a **new, empty project**, first confirm the Supabase organization, project name, region, and plan. Copy `.env.example` to `.env.local` and set the new project's URL and publishable/anon key from **Project Settings → API**. These are public frontend configuration values, not service-role secrets.

Review the SQL before applying it in the new project's SQL Editor. Run `supabase/migrations/000_hadad_fresh_project_products.sql`, then migrations `003_hadad_live_integration.sql` through `012_hadad_contact_settings_owner_policy.sql` in numeric order, skipping missing numbers. Do **not** run legacy `001_hadad_schema.sql` or `002_hadad_security.sql` on a fresh project: they create the older, incompatible product model. Do not run the fresh-project bootstrap against the old project. See [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for feature/security details and review steps.

The dashboard signs in with Supabase Auth and only opens for accounts with the `hadad_owner` app-metadata claim; see [SUPABASE_SETUP.md](./SUPABASE_SETUP.md#2-dashboard-owner-login) to create the owner account. The dashboard route is configured in `src/lib/dashboardAuth.js`.

Never put a service-role/secret key in frontend code or any `VITE_` variable. Public visitors can read active products, public contact/payment details, and public bucket images. Do not change RLS policies to allow public owner-only writes.

## Catalog and owner dashboard

The public catalog reads active haircuts and packages from `public.products`. The dashboard includes product, Contact Settings, and Live Home editors. Supabase RLS requires the authenticated owner for writes, which the dashboard login provides. Do not weaken RLS.

The owner dashboard's **Contact Settings** section manages the public WhatsApp/contact phone numbers, Instagram and Facebook URLs, and InstaPay payment details. Public pages read these values from `public.hadad_contact_settings`; optional contact links and payment instructions are hidden when their values are empty. **Live Home** manages bilingual hero content, its image, booking warning messages, and shop opening/closing hours. The warning text and times are stored together in the existing `rules_en` and `rules_ar` text columns of `public.hadad_home_settings`; legacy plain-text warnings remain readable and use the default hours until saved from Live Home. The public homepage displays the saved warning and formatted hours. Checkout offers 30-minute time preferences only during those hours and rechecks the latest settings before opening WhatsApp; these are preferences, not confirmed availability. The public checkout prepares a prefilled WhatsApp message and does not save customer details or appointment requests. Customers review and send the message themselves.

## Development

```sh
npm install
npm run dev
```

For Vercel, use `npm run build` as the build command and `dist` as the output directory. The included `vercel.json` sends client-side routes to the app entry point, so directly visiting or refreshing the private dashboard route works.

Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Vercel project's Environment Variables for each required deployment environment, then redeploy after adding or changing them. Never configure a service-role/secret key in the Vite frontend. Without the Supabase variables, the deployed app stays in preview mode. The checkout's default working hours remain 12:00 PM–1:00 AM.

Build and lint:

```sh
npm run build
npm run lint
```
