# Amanat Shopping — order and business management

Operations app for Amanat Shopping, Kandahar. A client sends us a product link,
a photo and a quantity; we buy the item abroad, bring it in, and they collect it
from our office. This tracks the order and the money at every step, and gives
the client a page to check on it themselves.

It runs on Postgres (Neon in production) with server actions, staff logins
and a public storefront. There is no mock data and nothing lives in the browser:
open it on a fresh database and it will take you to `/setup` to create the first
account.

```bash
npm install
cp .env.example .env.local     # put a connection string in it
npm run db:migrate             # optional — the app will do this itself
npm run dev                    # http://localhost:3000
```

`DATABASE.md` is the full account of connecting a database, and the first place
to look when one will not connect.

---

## What is in the box

### Operations — behind a staff login

| Route | What it does |
|---|---|
| `/` | KPIs, revenue vs cost, order pipeline, sales by store, "needs attention" |
| `/orders`, `/orders/[id]`, `/orders/new` | Order lifecycle, items, purchases, tracking, payments, activity |
| `/clients`, `/clients/[id]`, `/clients/new` | Contact book, order history, payments, running-balance statement |
| `/purchases`, `/purchases/[id]` | Where we bought it, the store's order number, what it cost |
| `/payments` | Client payments ledger with receipts |
| `/finance`, `/finance/balances` | P&L, receivables ageing |
| `/documents` | Register of every printable document |
| `/print/{invoice,quotation,receipt}/[id]` | A4 print-ready sheets |
| `/settings/*` | Company profile, stores, payment methods, team |

### The shop — its own admin

| Route | What it does |
|---|---|
| `/shop`, `/shop/products` | The catalogue customers see, and what is published |
| `/shop/orders`, `/shop/orders/[id]` | Website orders as they arrive, and turning one into a real order |

### Public — no login

| Route | What it does |
|---|---|
| `/store`, `/store/p/[slug]` | Storefront: browse, search, filter, product gallery |
| `/store/cart`, `/store/checkout`, `/store/thanks` | Basket and checkout — writes a real order and notifies you |
| `/track` | A customer checking on their order by reference |

### Accounts

`/setup` creates the first owner; `/login` after that. One account per person,
scrypt-hashed passwords, database-backed sessions that store only the SHA-256 of
the cookie token, and lockout after repeated failures.

---

## Money

**Afghani only.** Every field named `*_afn` is a whole number of Afghani. There
is no second currency, no exchange rate and no conversion anywhere in the code —
what a purchase cost abroad is entered by an admin as the AFN figure they
actually paid. Nothing is guessed on their behalf: no percentage markup, no
auto-suggested price, no pre-filled delivery charge.

All money arithmetic lives in `src/lib/finance.ts` and is pure, so the
dashboard, the order page, the client statement and the P&L cannot disagree.

## Tracking

Internal only. No DHL, FedEx or AfterShip — we mint our own reference, and the
public page reports where the parcel is because a member of staff moved it to
that status. References are unique at the database level and minted under an
advisory lock inside the writing transaction, so two people creating an order at
the same moment cannot collide.

The public projection is built by **naming** the fields a customer may see, not
by removing the ones they may not, so a column added to `orders` tomorrow does
not leak by default.

---

## Architecture

```
src/
  app/
    (app)/        Operations screens, inside the sidebar shell
    (auth)/       Login and first-run setup
    (print)/      Print route group — no chrome, A4 sheet
    (public)/     The customer's tracking page
    (shop)/       Shop admin
    (store)/      The storefront
  components/
    ui/           shadcn/ui primitives (Radix + CVA + Tailwind)
    layout/       Sidebar, topbar, command palette, app shells
    shared/       DataTable, StatCard, StatusBadge, Timeline, Money…
    brand/        Logo lockup
  db/
    schema.ts     17 tables — the source of truth
    index.ts      The connection: lazy, one per process, pooler-safe
    ensure-schema.ts  Creates the schema on first use if a deploy did not
    map.ts        Row ↔ domain conversions
    url.ts        Finding the connection string, and explaining a bad one
  features/       One folder per domain area; screens and dialogs
  lib/
    types.ts      Domain model
    finance.ts    Pure money derivations (no I/O)
    tracking.ts   Reference minting
    server/       Server actions — the only things that touch the database
    api/          Client-side read hooks and write functions
```

**The rule that keeps it honest:** screens never import `@/db` or
`src/lib/server/*` directly. Reads arrive as props from a server component or
through `@/lib/api`; writes go through `src/lib/api/mutations.ts`, which calls a
server action and then refreshes. `server-only` at the top of `src/db/index.ts`
turns a mistake here into a build error rather than a connection string in a
browser bundle.

---

## Design

A grouped collapsible sidebar with section captions, KPI cards with a delta pill
and thin progress bar, status sub-tabs with count chips, dense sortable tables
with a per-row action menu, and a `Showing X of N` pagination footer. The
storefront shares none of that — it is laid out like a shop, because that is
what customers already know how to read.

Brand colours are sampled from the company logo: deep maroon (`--brand-*`) for
primary actions and chrome, gold (`--gold-*`) as the accent, neutral greys
everywhere else. Light and dark both supported.

> **Logo:** the mark is a vector reconstruction of the supplied logo
> (`src/components/brand/logo.tsx`). See `public/README-branding.md` for how to
> drop in the official artwork — the colour tokens are already correct.

---

## Stack

Next.js 16 (App Router) · TypeScript · Postgres via Drizzle ORM · Tailwind CSS
v4 · shadcn/ui (Radix) · TanStack Table · Recharts · Zustand · next-themes ·
Sonner · date-fns · lucide-react

## Scripts

```bash
npm run dev        # dev server
npm run build      # production build
npm run start      # serve the production build
npm run lint       # ESLint + React Compiler rules
npm run typecheck  # tsc --noEmit
npm test           # needs DATABASE_URL pointed at a scratch database

npm run db:generate   # write a migration from a schema change
npm run db:migrate    # apply migrations
npm run db:check      # is it reachable, are the tables there, anything stuck
npm run db:studio     # browse the data
```

## What is not built

See `TASKS.md` — product photos still live inside database rows rather than
object storage, and staff roles exist but do not yet restrict anything.
