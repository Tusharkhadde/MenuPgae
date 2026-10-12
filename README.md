# MenuPage

**QR menu + one-page website for restaurants, cafés and small food vendors.**
Owners build their menu in a dashboard, print table QR codes, and guests order on WhatsApp — no app, no commission. Multi-currency (₹, $, €, £, AED, S$ …), mobile-first, SEO-ready, and designed to run on free tiers.

- **Stack:** Next.js 16 (App Router, TypeScript strict) · Tailwind CSS v4 + shadcn/ui · Postgres (Neon) + Drizzle ORM · Auth.js v5 (Google, email magic links via Resend, demo sandbox) · Cloudflare R2 uploads · Dodo Payments billing · Zod · Vitest · GitHub Actions
- **Cost to run:** $0 on Vercel Hobby + Neon Free + Cloudflare R2 Free + Resend Free + Dodo (pay-per-transaction only).

---

## Features

| Area | What you get |
| --- | --- |
| **Onboarding** | 3-step wizard: name + live slug check, currency + timezone (auto-detected), theme, logo/cover, WhatsApp number, optional sample menu |
| **Menu editor** | Categories & items with price, photo, veg / non-veg / vegan / egg mark, spice level, allergens, bestseller, one-tap sold-out, drag-and-drop reorder (keyboard accessible) |
| **Business info** | Hours per day (split shifts, past-midnight), address + Google Maps link, phone, WhatsApp, Instagram, Google reviews, Swiggy / Zomato / Uber Eats links |
| **Public page** `/r/{slug}` | Fast mobile-first page: cover, open/closed-now badge (restaurant's timezone), call / WhatsApp / directions buttons, search, category jump-nav, dietary filters, 4 themes (Classic, Midnight, Fresh, Street) |
| **WhatsApp ordering** | Cart → "Order on WhatsApp" opens a prefilled message (items, qty, total, table, name, note) to the restaurant's number. Table number comes from the QR (`?t=5`) |
| **QR codes** | Main + per-table codes, PNG/SVG download, printable A4 table tents (print or "Save as PDF") |
| **Analytics** | Own table, no cookies, no IPs stored: page views, QR scans, WhatsApp order taps, top dishes, busiest tables. 7 days on Free, 90 on Pro |
| **SEO** | Per-restaurant metadata, canonical URLs, JSON-LD `Restaurant` + `Menu`/`MenuSection`/`MenuItem` with offers, dynamic OG images, sitemap, robots |
| **Sizes & add-ons** | Item variants (Half/Full, S/M/L) with their own prices and modifier groups (required/optional, min/max). Shown in an item sheet, the cart and the WhatsApp message; re-priced on the server for every order |
| **Orders inbox** | Every order is also saved to the dashboard (WhatsApp still opens). Live inbox (polling every 4 s), sound alert, statuses new → preparing → ready → done, paid toggle, daily count/sales/paid totals. Restaurants without WhatsApp can take orders straight to the inbox |
| **Kitchen display** (Pro) | Full-screen `/kitchen/{id}` board: tap a ticket to bump it, age timers, table requests on top |
| **UPI pay (India)** | After ordering, a `upi://pay` button + QR with the exact amount to the restaurant's UPI ID — no gateway, no fees |
| **Table service** | "Call waiter" / "Request bill" buttons for guests who scanned a table QR → appear live in the inbox and kitchen display |
| **Scheduling & specials** | Timed menus per category (breakfast/lunch/dinner), day-of-week + time windows per item, "Today's special" strip, promo banner. Happy-hour pricing and coupon codes are Pro |
| **Reviews funnel** | Post-order rating: 4–5★ → your Google reviews link, 1–3★ → private feedback in the dashboard |
| **Reservations** (Pro) | Guest request form (date, time, party size) → dashboard + email alert (Resend) → accept/decline, guest emailed + one-tap WhatsApp reply |
| **Multi-language menus** | Owner-entered translations per item/category, language switcher, RTL for Arabic. 1 extra language on Free, 6 on Pro. Optional AI drafts (Gemini) on Pro |
| **Menu import** | CSV (Excel/Sheets export) with template + preview + per-line errors. Optional AI import from a menu photo (Gemini, Pro) |
| **Team** (Pro) | Invite by email as manager (menu, orders, guests, QR, analytics) or staff (orders only). Enforced server-side |
| **Share** | Installable PWA with offline menu, iframe embed snippet for existing websites (`/embed/{slug}`), link-in-bio page (`/l/{slug}`), printable branded A4 menu, calories + nutrition |
| **Weekly digest** (Pro) | Monday email with views, orders, sales, top dishes, ratings and pending reservations (Vercel Cron + Resend; skipped without keys) |
| **Dashboard home** | Today's orders, sales, views and rating, open table requests, reservations to confirm, setup checklist |
| **Plans** | Free (1 restaurant, 50 items, badge, 7-day analytics/order history, 1 extra language) and Pro (10 branches, 1,000 items, custom domain, no badge, 90 days, kitchen display, coupons, happy hour, reservations, 6 languages, team, digest, AI tools) — enforced server-side; downgrade pauses extras, never deletes |
| **Billing** | Dodo Payments checkout, Standard-Webhooks signature verification, idempotent + out-of-order-safe webhook processing, customer portal. Fully optional |
| **Custom domains** | Pro feature. Optional automatic setup through the Vercel Domains API; DNS instructions in the dashboard |
| **Marketing site** | Landing page, pricing (currency switch), FAQ, live demo restaurant (`/r/demo`), terms & privacy placeholders, light + dark mode |
| **Security** | Owner-only authorization on every mutation, Zod validation, rate limits on public endpoints, image magic-byte sniffing + 4 MB limit (client-side resize to WebP first), reserved slugs, same-origin checks, security headers, runtime env validation |

> No fake testimonials, logos, user counts or metrics anywhere — by design.

---

## Quick start (local, zero setup)

```bash
git clone https://github.com/Tusharkhadde/MenuPgae.git menupage
cd menupage
npm install
npm run db:seed     # creates the embedded dev DB + the /r/demo restaurant
npm run dev         # http://localhost:3000
```

With no environment variables at all:
- the database is an embedded Postgres (**PGlite**) stored in `.data/pglite` (migrations run automatically),
- "Email me a sign-in link" prints the magic link to the **terminal**,
- "Try the dashboard with a demo account" creates a private sandbox,
- uploads go to `.data/uploads`,
- billing shows "not configured".

To use a real Postgres locally, copy `.env.example` → `.env.local` and set `DATABASE_URL`, then `npm run db:migrate && npm run db:seed`.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run lint` / `typecheck` / `test` / `build` | Quality gates (all run in CI) |
| `npm run check` | All four in a row |
| `npm run db:generate` | Generate a migration after editing `src/lib/db/schema.ts` |
| `npm run db:migrate` | Apply migrations (`DATABASE_URL_UNPOOLED` or `DATABASE_URL`) |
| `npm run db:seed` | Migrate + (re)create the public demo restaurant at `/r/demo` |
| `npm run db:studio` | Drizzle Studio |

---

## Deploy for $0 — step by step

You need accounts on: **GitHub** (have it), **Vercel**, **Neon**, **Cloudflare** (R2), **Resend**, **Google Cloud** (OAuth), and optionally **Dodo Payments**.

### 1. Neon (Postgres)
1. <https://neon.tech> → New project (pick the region closest to your users, e.g. `aws-ap-south-1` Mumbai).
2. Dashboard → **Connect** → copy the **pooled** connection string (host contains `-pooler`) → this is `DATABASE_URL`.
3. Toggle "Connection pooling" off and copy the **direct** string → `DATABASE_URL_UNPOOLED` (used for migrations).

### 2. Vercel (hosting)
1. <https://vercel.com/new> → Import `Tusharkhadde/MenuPgae` (framework auto-detected: Next.js).
2. Add the environment variables below (Settings → Environment Variables), then **Deploy**.
3. The build runs `npm run vercel-build` = `db:migrate` + `next build`, so the schema is applied on every deploy.
4. After the first deploy, seed the demo once from your machine:
   `DATABASE_URL="<unpooled string>" npm run db:seed`
5. Set `APP_URL` to your final URL (e.g. `https://menupage.vercel.app` or your domain) and redeploy.

### 3. Auth secret
`npx auth secret` (or `openssl rand -base64 33`) → `AUTH_SECRET`.

### 4. Google sign-in
1. <https://console.cloud.google.com> → APIs & Services → OAuth consent screen (External, add your email as test user or publish).
2. Credentials → Create OAuth client ID → Web application.
3. Authorized redirect URI: `https://YOUR_DOMAIN/api/auth/callback/google` (add `http://localhost:3000/api/auth/callback/google` for local).
4. Copy client ID/secret → `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`.

### 5. Resend (magic-link email)
1. <https://resend.com> → API Keys → create → `AUTH_RESEND_KEY`.
2. Domains → add and verify your domain (DNS records), then set `EMAIL_FROM="MenuPage <login@yourdomain.com>"`.
   (Without a verified domain Resend only delivers to your own address from `onboarding@resend.dev`.)

### 6. Cloudflare R2 (images)
1. Cloudflare dashboard → R2 → Create bucket `menupage`.
2. Bucket → Settings → **Public access**: enable the `r2.dev` subdomain (or connect a custom domain) → that URL is `R2_PUBLIC_URL`.
3. R2 → Manage API tokens → Create token with **Object Read & Write** on that bucket → `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`.
4. Your Cloudflare **Account ID** (R2 overview page) → `R2_ACCOUNT_ID`.
   No CORS setup needed — uploads go through the app server.

### 7. Dodo Payments (optional — app runs without it)
1. <https://app.dodopayments.com> → switch to **Test Mode**.
2. Products → create a **Subscription** product "MenuPage Pro", monthly, at your price. Set the **subscription period longer than the billing frequency** (e.g. 20 years, billed monthly) or it ends after one cycle. Copy the product id → `DODO_PRODUCT_PRO`.
3. Developer → API Keys → create → `DODO_PAYMENTS_API_KEY`. Set `DODO_PAYMENTS_ENVIRONMENT=test_mode`.
4. Developer → Webhooks → add endpoint `https://YOUR_DOMAIN/api/webhooks/dodo`, subscribe to all `subscription.*` events and `payment.succeeded`, copy the signing secret (`whsec_…`) → `DODO_PAYMENTS_WEBHOOK_SECRET`.
5. Test: Dashboard → Plan & billing → Upgrade → pay with a Dodo test card → you return to the billing page and Pro activates when the webhook lands. "Manage billing" opens the Dodo customer portal.
6. **Go live:** recreate the product and webhook in Live Mode (new ids/secret), use the live API key and `DODO_PAYMENTS_ENVIRONMENT=live_mode`.

> Indian cards (RBI e-mandate): renewals can take ~48h and mandates over ₹15,000 need re-authentication; Dodo handles this, and the app keeps Pro during `past_due` until the grace period ends.

### 8. Custom domains (optional, Pro)
Owners enter a domain in **Settings → Custom domain** and get DNS instructions (CNAME `cname.vercel-dns.com` for subdomains, A `76.76.21.21` for apex).
- **Automatic:** create a Vercel token (Account → Tokens) and set `VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID` (Project → Settings → General) and `VERCEL_TEAM_ID` if the project is in a team. The app adds/verifies/removes domains via the Vercel API.
- **Manual:** leave those unset and add each domain yourself in Vercel → Project → Domains.
`src/proxy.ts` rewrites requests for a custom domain to that restaurant's page.

---

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `APP_URL` | prod | Public base URL (QR codes, canonical links, billing return URLs) |
| `DATABASE_URL` | **prod** | Neon pooled connection string |
| `DATABASE_URL_UNPOOLED` | recommended | Direct connection for migrations |
| `AUTH_SECRET` | **prod** | Auth.js session encryption |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | optional | Google sign-in |
| `AUTH_RESEND_KEY`, `EMAIL_FROM` | optional* | Email magic links (*at least one of Google/Resend for real users) |
| `DEMO_LOGIN_ENABLED` | optional | `false` to hide the demo sandbox login (default on) |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` | for uploads in prod | Image storage |
| `DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_WEBHOOK_SECRET`, `DODO_PAYMENTS_ENVIRONMENT`, `DODO_PRODUCT_PRO` | optional | Billing (disabled unless all set, plus `APP_URL`) |
| `PRO_EMAILS` | optional | Comma-separated emails that get Pro for free (your freelance clients) |
| `VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID`, `CUSTOM_DOMAIN_TARGET` | optional | Automatic custom domains |
| `CRON_SECRET` | optional | Protects `/api/cron/digest` (Vercel Cron sends it as a Bearer token). Unset → digest is skipped |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | optional | AI translate + menu-photo import (Pro). Free Google AI Studio key; default model `gemini-3.5-flash-lite` |

`AUTH_RESEND_KEY` + `EMAIL_FROM` also power reservation alerts, team invites and the weekly digest; without them those emails are skipped and everything else works.

`next build` needs **none** of these — everything is validated lazily at runtime with clear error messages.

---

### Weekly digest cron
`vercel.json` schedules `GET /api/cron/digest` every Monday 03:30 UTC (09:00 IST). Vercel Hobby allows daily-or-slower crons, so this is free. Set `CRON_SECRET` in Vercel (any long random string) — Vercel adds it automatically as the `Authorization` header.

### Migrations
`drizzle/0001_beast.sql` only **adds** tables (`orders`, `service_requests`, `feedback`, `reservations`, `coupons`, `team_members`) and columns with defaults — safe on an existing database. It runs automatically on deploy (`vercel-build`) or with `npm run db:migrate`.

---

## Prices & plan limits

All plan limits and the **placeholder** display prices live in one file: [`src/config/plans.ts`](src/config/plans.ts).
Current placeholders: **Pro ₹299/month · $5/month · €5 · £4 · AED 19 · S$7**. The amount actually charged is whatever your Dodo product is set to — update both.

---

## Project structure

```
src/
  app/
    (marketing)/        landing, pricing, terms, privacy
    r/[slug]/           public restaurant page + OG image
    site/[domain]/      same page for custom domains (via proxy.ts)
    q/[slug]/           QR entry point: counts the scan, redirects to the menu
    dashboard/          dashboard (overview, orders, menu + import/translate/print, guests, promotions, info, design, QR & sharing, analytics, team, settings, billing)
    kitchen/[id]/       full-screen kitchen display (Pro)
    l/[slug]/           link-in-bio page
    embed/[slug]/       iframe-embeddable menu (frame-ancestors *)
    api/                auth, upload, track, orders (+quote), service requests, feedback, reservations, live feed, PWA manifest/icon, digest cron, billing, Dodo webhook, QR downloads
  components/           ui (shadcn), marketing, dashboard, menu (public page)
  config/               plans.ts (limits + placeholder prices), reserved slugs, site
  lib/                  pure logic: hours, money, whatsapp, options (variants/add-ons), order pricing, schedule (timed menus, happy hour, coupons), upi, csv-import, languages, reservations, digest, roles, limits, validation, billing/*, qr, storage, env
  server/               server-only data access, actions (all authorized), billing, analytics, demo sandbox
drizzle/                SQL migrations
scripts/                migrate + seed
public/sw.js            service worker (offline menus)
tests/                  Vitest unit tests (hours, money, WhatsApp, plans/limits/gating, billing webhook, validation, options, order pricing, scheduling/coupons, UPI, CSV import, languages, reservations, digest, roles)
```

## Notes & limitations
- The orders inbox updates by polling every 4 seconds (20 s when the tab is hidden) — no websockets needed on Vercel Hobby. Sound alerts need one tap on "Sound" (browser autoplay rules).
- UPI payments go straight to the restaurant; MenuPage can't confirm them. Staff mark orders "paid" in the inbox after checking their UPI app.
- Excel `.xlsx` files aren't parsed directly — export to CSV first (no extra dependency, keeps the bundle small).
- Rate limiting is in-memory per server instance (good burst protection on serverless, not a global quota). Swap in Upstash/Redis if you need strict limits.
- Public pages are cached (ISR, 5 min) and revalidated instantly when the owner edits; the open/closed badge is computed in the browser so it's always current.
- Legal pages are placeholders — have them reviewed before launch (GDPR for EU, DPDP Act for India).
