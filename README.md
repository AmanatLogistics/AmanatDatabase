# Amanat Shopping — Client Order & Business Management System

Internal operations app for Amanat Shopping. Clients send us a product link, a
photo and a quantity; we buy the item from Amazon, Daraz, Noon or AliExpress,
consolidate it through a forwarder, ship it to Kabul, hand it over, and track
the money at every step.

This repository currently contains the **frontend only**. It runs on a realistic
in-memory dataset and is structured so a real API can be dropped in without
touching any screen.

```bash
npm install
npm run dev      # http://localhost:3000
```

---

## What is in the box

| Area | Route | What it does |
|---|---|---|
| Dashboard | `/` | KPIs, revenue vs cost chart, order pipeline, sales by store, "needs attention" |
| Orders | `/orders`, `/orders/[id]`, `/orders/new` | Full order lifecycle, items, purchases, tracking, payments, activity |
| Clients | `/clients`, `/clients/[id]`, `/clients/new` | Contact book, order history, payments, running-balance statement |
| Purchases | `/purchases`, `/purchases/[id]` | Where we bought it, store order number, USD cost and FX rate |
| Tracking | `/tracking`, `/tracking/[id]` | Carrier, tracking number, event timeline, landed cost |
| Payments | `/payments` | Client payments ledger with receipts |
| Finance | `/finance`, `/finance/expenses`, `/finance/balances` | P&L, expense register, receivables ageing |
| Documents | `/documents` | Register of every printable document |
| Print | `/print/{invoice,quotation,receipt,packing-list,label}/[id]` | A4 print-ready sheets |
| Settings | `/settings/*` | Company profile, stores, payment methods, expense categories, team |

**Working interactions** — creating an order, recording a payment, logging a
purchase, adding tracking, adding an expense and changing an order's status all
mutate the shared store and every dependent figure recalculates immediately
(client balance, order margin, dashboard KPIs, ageing report).

State lives in memory and **resets on a full page reload**. That is deliberate
for a frontend-only build.

---

## Money model

- The reporting and billing currency is **AFN**. Every field named `*Afn` is a
  whole number of Afghani.
- Purchases from foreign stores are recorded in **USD** (`*Usd`) together with
  the `fxRate` in force on the day, so historic costs never drift when the rate
  moves.
- A quoted product price is the **landed** price: the store's sticker price
  converted at roughly `fx × 1.15`, which absorbs the store's sales tax,
  domestic shipping to the forwarder, and FX drift. The order's **service fee**
  (14% by default) is the margin on top.

All money maths lives in one place — `src/lib/finance.ts` — so the dashboard,
the order page, the client statement and the P&L can never disagree.

---

## Architecture

```
src/
  app/
    (app)/                 Screens inside the sidebar shell
    (print)/               Print route group — no chrome, A4 sheet
  components/
    ui/                    shadcn/ui primitives (Radix + CVA + Tailwind)
    layout/                Sidebar, topbar, command palette, app shell
    shared/                DataTable, StatCard, StatusBadge, Timeline, Money…
    brand/                 Logo lockup
  features/                One folder per domain area; screens and dialogs
  lib/
    types.ts               Domain model — the contract the API must satisfy
    constants.ts           Status registries, labels, badge tones
    finance.ts             Pure money derivations (no I/O)
    format.ts              Currency, date and text formatting
    mock/                  Deterministic seed data
    store.ts               Zustand store (stand-in for the server)
    api/
      queries.ts           Read hooks — one per future GET endpoint
      mutations.ts         Async write functions — one per future POST/PATCH
```

### Connecting a real backend

Screens never import `@/lib/store` or `@/lib/mock/*`. They only use
`@/lib/api`. That is the seam:

1. **Reads.** Every hook in `src/lib/api/queries.ts` carries a comment naming the
   endpoint it stands for (`GET /api/orders`, `GET /api/clients/:id`, …). Replace
   the body with a `useQuery` / `use(fetch(...))` against that endpoint. The
   return shapes (`OrderRow`, `ClientRow`, `DashboardData`, …) are the contract —
   keep them and no screen changes.

2. **Writes.** Every function in `src/lib/api/mutations.ts` is already `async`,
   takes a typed input and returns the created entity. Swap the store call for
   `await fetch(endpoint, { method, body })`.

3. **Delete** `src/lib/store.ts` and `src/lib/mock/` once nothing references
   them. `src/lib/finance.ts` stays — it is pure and equally useful on a server.

Because `finance.ts` is pure, the same derivations can be reused server-side to
guarantee the API and the UI agree on every figure.

---

## Design

Layout, spacing, tables and navigation follow the supplied reference
screenshots: a grouped collapsible sidebar with section captions, KPI cards with
a delta pill and thin progress bar, status sub-tabs with count chips, dense
sortable tables with a per-row action menu, and a `Showing X of N` pagination
footer.

Brand colours are sampled from the company logo — a deep maroon (`--brand-*`)
for primary actions and brand chrome, gold (`--gold-*`) as the accent, and
neutral greys everywhere else. Both light and dark themes are supported.

> **Logo:** the mark is currently a vector reconstruction of the supplied logo
> (`src/components/brand/logo.tsx`). See `public/README-branding.md` for how to
> drop in the official artwork — the colour tokens are already correct.

---

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui (Radix) ·
TanStack Table · Recharts · Zustand · next-themes · Sonner · date-fns ·
lucide-react

## Scripts

```bash
npm run dev      # dev server
npm run build    # production build (typechecks as part of the build)
npm run start    # serve the production build
npm run lint     # ESLint + React Compiler rules
```

## Not built yet

Backend, database, authentication, API routes, file uploads. Buttons that would
need them (logo upload, invite team member, sign out) are visibly disabled and
labelled.
