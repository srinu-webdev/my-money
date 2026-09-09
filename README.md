# LendPro — Money Lending Management System (Next.js)

A production-shaped rebuild of the LendPro prototype: **Next.js 16 (App Router) + TypeScript + Tailwind CSS v4**, backed by a **real Postgres database (Supabase) via Prisma**, with **real server-side authentication** (bcrypt-hashed passwords, signed HttpOnly JWT session cookies verified in `proxy.ts`).

Unlike the original single-file prototype, nothing here is simulated: data lives in Postgres, mutations are Server Actions, pages are Server Components that read fresh data on every request.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 (CSS-first `@theme`, class-based dark mode via `next-themes`) |
| Database | PostgreSQL (Supabase), via Prisma 7 (driver adapter `@prisma/adapter-pg`, no Rust engine) |
| Auth | Custom — bcrypt + signed JWT cookie (`jose`), verified in `src/proxy.ts` on every request |
| Charts | Chart.js via `react-chartjs-2` |
| Toasts | `sonner` |
| Validation | `zod` |

## Project layout

```
prisma/
  schema.prisma      # data model
  seed.ts             # demo data (20 customers, 30 loans, ~100 payments...)
src/
  proxy.ts             # route protection (Next 16's middleware.ts successor)
  middleware/config    # (see proxy.ts — matcher covers everything but /, /login, static assets)
  lib/
    calculations.ts    # the interest engine — pure functions, no framework deps
    dates.ts, format.ts, reports.ts, chart-utils.ts
    db.ts               # Prisma client singleton (driver adapter)
    auth.ts             # session cookie + password hashing
    serialize.ts        # Prisma row -> plain domain type (Decimal/Date -> number/string)
    validations.ts      # zod schemas
    actions/            # Server Actions ("use server") — all mutations + on-demand reads for modals
    queries.ts           # Server Component reads (import "server-only")
  components/
    ui/                 # Button, Card, Table, Modal, ConfirmDialog, Badge, ...
    layout/             # Sidebar, Topbar, GlobalSearch, NotificationBell, ...
    customers/ loans/ payments/ reports/ notifications/ settings/ profile/ charts/ dashboard/
  app/
    page.tsx            # public landing page
    login/page.tsx
    (dashboard)/        # route group: layout.tsx does the auth check + shell, then 12 pages
```

## First-time setup

1. **Get the correct Supabase connection strings.**
   Supabase Dashboard → your project → **Connect** button (top of the page) → copy the **URI** connection strings:
   - `DATABASE_URL` → the **Transaction pooler** string (port `6543`, add `?pgbouncer=true`) — used at runtime.
   - `DIRECT_URL` → not currently used (Prisma 7's driver-adapter migrations don't need it — see `prisma.config.ts`), but keep the direct (port `5432`) string handy in case you add it back.

   The password that was pasted into the chat that produced this project did **not** authenticate against `db.<project-ref>.supabase.co:5432` (connection reached the server, Postgres rejected the password) — get the current one from **Project Settings → Database → Reset database password** if you're not sure, and paste the resulting connection string(s) into `.env`.

2. **Fill in `.env`** (already git-ignored):
   ```
   DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true"
   AUTH_SECRET="<already generated for you — see .env>"
   ```

3. **Install deps** (already done in this checkout, `node_modules` included in the working tree since npm's install had to be run once already — but on a fresh clone):
   ```
   npm install
   ```

4. **Create the tables and seed demo data:**
   ```
   npm run db:push     # prisma db push — creates tables from prisma/schema.prisma
   npm run db:seed     # prisma db seed — 1 admin, 20 customers, 30 loans, ~100 payments, ...
   ```
   The seed script is idempotent — it no-ops (except ensuring the admin account exists) if any customers already exist.

5. **Run it:**
   ```
   npm run dev
   ```
   Login: `admin@example.com` / `admin123`.

## Verified so far (without a live DB connection)

- `npm run build` — clean (TypeScript + all 14 dashboard routes + landing, zero errors).
- `npm run lint` — clean (zero errors, zero warnings — including React's newer purity/effects rules).
- `npm run dev` boots; `/` and `/login` render correctly; visiting a protected route while logged out correctly 307-redirects to `/login?from=...` (proxy-level auth check, no DB needed to prove that part works).

**Not yet verified end-to-end** (needs the real `DATABASE_URL`): `db push`, `db seed`, login, and every DB-backed page. Once the connection string above is fixed, run steps 4–5 and everything should light up — but treat the first real run as the actual first test of the full stack.

## Notable design choices

- **Interest engine** (`lib/calculations.ts`) is framework-agnostic and pure — same functions run in Server Components (initial page data), Server Actions (validation before a write), and Client Components (live previews in the loan/payment forms), so there's exactly one implementation of "how interest accrues."
- **Nothing is cached across requests** — every dashboard page/layout is `force-dynamic` (or implicitly dynamic via `cookies()`), and every Server Action calls `revalidatePath("/", "layout")` after a write, so the whole authenticated shell (including sidebar badge counts and the notification bell) reflects a write immediately.
- **IDs** (`CUS-2026-0001` style) are allocated atomically inside the same Prisma transaction as the row they belong to, via a `Counter` table.
- **Loan status** (Active/Partially Paid/Paid/Overdue/Cancelled) is never stored except for the two states that require a stored fact (Paid because someone closed it, Cancelled) — everything else is derived at read time from payments vs. due date, so editing/deleting a payment "just works" without any manual recalculation step.
