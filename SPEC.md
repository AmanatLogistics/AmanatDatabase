# Amanat Shopping — Restructuring Spec

Written against the repo at commit `69716d4`. Every file path, field name and
line reference below was read from the working tree, not assumed. Anything that
does not exist is marked **does not exist** rather than invented.

---

## 0. Current state of the repo (the ground truth this spec is written against)

**This is a frontend-only application.** There is no backend, no database, no API
route handler, no server action, no authentication, and no file storage.

| Thing | Status | Evidence |
|---|---|---|
| Database / ORM / migrations | **does not exist** | No `prisma/`, `drizzle/`, schema or migration file anywhere |
| API route handlers (`route.ts`) | **does not exist** | No `route.ts` in `src/app` |
| Server actions (`"use server"`) | **does not exist** | Zero occurrences in `src/` |
| Authentication | **does not exist** | No `middleware.ts`; no auth dependency in `package.json` |
| File / image upload | **does not exist** | No `type="file"`, no `FileReader`, no `FormData` in `src/` |
| Image storage | **does not exist** | `next.config.ts` → `images: { remotePatterns: [] }` |
| Tests | **does not exist** | No `*.test.*`, `*.spec.*`, no vitest/jest config |
| `loading.tsx` / `error.tsx` | **does not exist** | `src/app/not-found.tsx` is the only special file in the app tree |

State lives in a Zustand store, `src/lib/store.ts`, seeded from
`src/lib/mock/seed.ts`, and **resets on every full page reload** (`store.ts:15-26`).
Screens never import the store directly; they go through `src/lib/api/`
(`queries.ts` for reads, `mutations.ts` for writes). That seam is the intended
place for a real backend to land later.

### 0.1 Two corrections to the original brief

**a) There is no `$` in this codebase.** The requirement "Remove hardcoded `$`
everywhere" is already satisfied. A `rg -P '\$(?!\{)'` sweep across `src/`
returns 271 lines containing `$`; 270 are `${...}` template interpolations and
the single remainder is a regex end-anchor at `src/lib/api/mutations.ts:44`.
The app is already AFN-only: `formatAfn()` in `src/lib/format.ts:23-32` is the
one money formatter and it hardcodes the literal `"AFN"`.

**b) `README.md:47-50` is stale.** It claims purchases record USD alongside an
`fxRate`. `fxRate` has **zero occurrences** repo-wide, and `Purchase`
(`src/lib/types.ts:146-164`) carries only `totalCostAfn`. The optional USD
reference fields proposed in Phase 2 would be genuinely new fields, not a
restoration of something that was removed.

### 0.2 The baseline does not currently build

`main` (and therefore this branch) fails both `npx tsc --noEmit` (24 errors) and
`npm run build`. Two files reference four identifiers that exist nowhere:

- `src/features/finance/expenses-screen.tsx` — imports `createExpense`,
  `useExpenseCategories`, `useExpenseRows`, `ExpenseRow` from `@/lib/api`
- `src/features/settings/expense-categories-screen.tsx` — imports
  `upsertExpenseCategory`, `useExpenseCategories`, `useExpenseRows` from
  `@/lib/api` and the type `ExpenseCategory` from `@/lib/types`

`expenses-screen.tsx:192` additionally passes a `breadcrumbs` prop that
`PageHeader` does not accept. The expense-category feature is half-landed: the
screens exist, the data layer behind them does not.

**Consequence:** until this is repaired, "run typecheck and build after each
task" cannot produce a green result, so no Phase 1 task can be verified to the
standard required. Repairing it is **TASK 0** and must happen first.

---

## 1. Decisions taken

Confirmed by the project owner during the spec interview:

| # | Decision |
|---|---|
| D1 | **Backend comes last.** The frontend is built out fully first, against the in-memory store. Phase 1 ships frontend-only. |
| D2 | **A separate `trackingNumber` field is added to `Order`.** `orderNo` stays as the internal sequence. |
| D3 | **The existing 11 `OrderStatus` values are kept.** Only `on_hold` is added, for 12 total. |
| D4 | Third-party carrier tracking is **isolated, not deleted** (see §2.5 — removal is unsafe, and this is the "if removal is risky" escape the brief allowed for). |

---

## 2. PHASE 1 — Our own manual tracking

### 2.1 Status lifecycle — the exact enum

The brief proposed 8 statuses. The repo already has 11, and they are load-bearing
across `ORDER_PIPELINE`, `ORDER_TERMINAL`, `BILLABLE_ORDER_STATUSES`,
`ACTIVE_ORDER_STATUSES` (`src/lib/constants.ts:52-108`), the order-detail
stepper, the orders-list tab filters and the dashboard. Per **D3** they are kept
and `on_hold` is added.

Final `OrderStatus` (`src/lib/types.ts:51-62`) — 12 values:

```
requested · quoted · confirmed · purchasing · purchased · in_transit
arrived · ready_for_pickup · delivered            ← ORDER_PIPELINE (unchanged)
on_hold                                            ← NEW
cancelled · refunded                               ← ORDER_TERMINAL
```

`on_hold` is **not** added to `ORDER_PIPELINE` (it is not a happy-path stage) and
**not** to `ORDER_TERMINAL` (an order can leave it). It needs:

- an entry in `ORDER_STATUS` (`constants.ts:66-84`) with a `label`, a `tone` and
  a `dot`. Proposed: `meta("on_hold", "On hold", "warning", "bg-warning")`
- inclusion in `ACTIVE_ORDER_STATUSES` (`constants.ts:99-108`) — a held order is
  still open work
- **exclusion** from `BILLABLE_ORDER_STATUSES` (`constants.ts:87-96`) — matching
  how `cancelled` is treated
- a new export `ORDER_HOLD: OrderStatus[] = ["on_hold"]` so the status dropdown
  in `order-detail-screen.tsx:129-165` can render it as a third group between
  the pipeline group and the destructive terminal group

Every status change already writes a timestamped, optionally-noted timeline
entry via `updateOrderStatus(id, status, note?)`
(`src/lib/api/mutations.ts:193-220`), appending an `OrderEvent`
(`types.ts:103-110`: `id`, `at`, `status`, `title`, `description`, `actor`) to
`Order.timeline`. **The timeline requirement is already met by the data model.**
What is missing is a UI to type the note — today the dropdown calls
`updateOrderStatus` with no `note`, so every entry reads the default
`"Updated from the order page."` (`mutations.ts:209`).

### 2.2 The internal tracking number

Per **D2**, a new field on `Order` (`src/lib/types.ts:112-132`):

```ts
/** Public-facing tracking reference, e.g. "AS-2026-4F7K2Q". Unique. */
trackingNumber: string;
```

**Format:** `AS-YYYY-XXXXXX` where `XXXXXX` is 6 characters drawn from a
**Crockford base-32 alphabet with I, L, O and U removed**
(`0123456789ABCDEFGHJKMNPQRSTVWXYZ`, 32 symbols). Rationale: the ambiguous
glyph pairs are gone, so a number read aloud over WhatsApp or copied off a
printed slip does not turn into a failed lookup.

**Why random, not sequential.** `orderNo` is already sequential
(`AS-2026-0148`, generated by `nextSequence()` at `mutations.ts:41-48`). If the
public tracking number were also sequential, anyone holding one could enumerate
every other order and count the company's monthly volume. 32^6 ≈ 1.07 billion
values makes guessing impractical.

- Generated at creation inside `createOrder()` (`mutations.ts:147-190`), shown
  to the admin immediately on the order detail screen.
- Manually editable by the admin. Override goes through the existing
  `updateOrder(id, patch)` (`mutations.ts:222-229`).
- **Uniqueness:** cannot be enforced at the DB level — there is no DB (§0).
  For Phase 1 it is enforced in `createOrder()` by regenerating on collision
  against the in-memory `orders` array, and on manual override by rejecting a
  value already in use. This is **not** a real guarantee and is recorded in
  §7 Risks.

**Migration for existing orders.** Seeded orders in `src/lib/mock/seed.ts` have
no `trackingNumber`. Because the store is re-seeded on every reload, there is no
persisted data to migrate — the seed generator is updated to mint one per order.
`trackingNumber` is therefore declared **required** (not optional) on `Order`,
and TypeScript will surface every construction site that needs updating.

### 2.3 Admin: search and filter by tracking number

`orders-screen.tsx` currently searches this haystack (`orders-screen.tsx:151-153`):

```ts
const haystack = `${order.orderNo} ${client?.name ?? ""} ${client?.phone ?? ""} ${order.items
  .map((i) => i.name)
  .join(" ")}`.toLowerCase();
```

`order.trackingNumber` is added to it, and the `SearchInput` placeholder changes
from `"Search order no, client or product…"` to include the tracking number.
The global command palette search index (`src/lib/api/queries.ts:813`) gets the
same treatment.

One-click status change already exists as a dropdown in the orders list row
actions and on the detail screen — no change needed beyond adding `on_hold`.

### 2.4 Public client tracking page — NO login

**Route:** `/track` in a **new route group** `src/app/(public)/`, mirroring how
`src/app/(print)/` already escapes the admin chrome. A parenthesised directory is
a Next.js route group: it attaches a layout without contributing a URL segment.
`src/app/(public)/layout.tsx` will inherit the root layout (`src/app/layout.tsx`
— `<html>`, fonts, `ThemeProvider`, `Toaster`) but **not** `AppShell`, because
`src/app/(app)/layout.tsx` only wraps its own group's children.

Nothing currently gates any route — there is no auth — so a public page is
trivially possible today. The distinction is purely which layout wraps it.

**Exact exposed fields — this is the complete allowlist. Nothing else.**

| Exposed | Source field |
|---|---|
| Tracking number (echoed back) | `Order.trackingNumber` |
| Current status label | `ORDER_STATUS[Order.status].label` |
| Whether it has arrived at the office | derived: `status ∈ {arrived, ready_for_pickup, delivered}` |
| Product image | `OrderItem.imageUrl` (Phase 3; renders the existing `ProductThumb` placeholder until then) |
| Product name | `OrderItem.name` |
| Product description | `OrderItem.description` (Phase 3 — **does not exist** today) |
| Quantity | `OrderItem.qty` |
| Timeline: timestamp + status label per entry | `OrderEvent.at`, `OrderEvent.status` |

**Explicitly NOT exposed** — the client record in any form (no name, no phone
even partially, no address, no city, no `Client.code`), `Order.orderNo`,
`Order.notes`, `OrderEvent.description`, `OrderEvent.actor`, `OrderEvent.title`,
every `*Afn` money field, `OrderItem.unitCostAfn`, `OrderItem.unitPriceAfn`,
`OrderItem.productUrl`, `OrderItem.storeId`, `Purchase` in any form, and
`Shipment` in any form.

`OrderEvent.title` and `.description` are excluded deliberately: they are
free text written by staff (`mutations.ts:208-209`) and notes typed into the
Activity composer, so they can contain anything. The public timeline renders the
**status label from the registry**, never the stored text.

**This must be enforced by a dedicated projection, not by careful JSX.** A new
read hook in `src/lib/api/queries.ts`:

```ts
export interface PublicTrackingResult { /* the allowlist above, and nothing else */ }
export function usePublicTracking(trackingNumber: string): PublicTrackingResult | null
```

so the allowlist is one reviewable object literal rather than a property of how
the page happens to be written.

#### Security limits that CANNOT be met in Phase 1 — read this

The brief requires rate limiting and a generic not-found. Both are only
meaningful server-side, and **D1 defers the backend**. In a frontend-only build:

- **The entire dataset is already in the browser.** The page reads the same
  client-side Zustand store as the admin app. The projection above controls what
  is *rendered*, not what is *shipped* — anyone opening devtools can read every
  order, client and price regardless.
- **Rate limiting is not implementable.** There is no endpoint to limit. Any
  client-side throttle is cosmetic and bypassed by reloading.
- **Enumeration protection is partial.** The generic identical "not found"
  response will be implemented as specified, and the random tracking-number
  format (§2.2) is the real defence. But with the dataset in memory, the
  response text is not what protects it.

The page must therefore be treated as a **UI prototype, not a shippable public
surface**, and must not be deployed to a public URL until the backend lands.
Carried to §7 as the top risk. When the backend arrives, this page needs:
a `GET /api/track/:trackingNumber` handler returning exactly
`PublicTrackingResult`, an IP-based rate limit, and a constant-time-ish
identical 404 body for both "no such number" and "malformed number".

### 2.5 Carrier tracking — isolate, do not delete

The brief allowed isolation "if removal is risky". **It is risky**, so this spec
chooses isolation and explains why, as required.

`Shipment` (`src/lib/types.ts:187-205`) is not a leaf. Deleting it breaks:

- **`src/lib/finance.ts`** — structurally. `Shipment` is imported at `:14`;
  `LedgerIndex.shipmentByOrder` at `:40`; `buildLedgerIndex(...)` takes
  `shipments` at `:51-56` and populates at `:70`. The cost model reads freight
  and duty off the shipment at `:137,145-148`. Both reads are optional-chained
  with fallbacks (`FREIGHT_COST_RATIO = 0.75`, `constants.ts:260`), so it would
  not crash — **it would silently change every order's cost, profit and margin,
  and zero out customs duty across the whole P&L.** That is worse than a crash.
- **Dashboard** — `buildAttention()` (`queries.ts:402-445`) derives two of its
  four attention categories purely from shipments; `customsHolds`
  (`queries.ts:485`) feeds the sidebar badge.
- **Print documents** — `label-document.tsx` and `packing-list-document.tsx`
  are shipment-only and would be deleted, along with two routes; the document
  register (`queries.ts:726-752`) mints two rows per shipment.
- **Order detail** — `shipment` is destructured at `order-detail-screen.tsx:89`
  and drives the Tracking tab, two P&L rows, and three sidebar actions.

**Phase 1 therefore does this instead:**

1. Add `NEXT_PUBLIC_CARRIER_TRACKING_ENABLED` (default `false`) read once into a
   single exported constant, `CARRIER_TRACKING_ENABLED`, in
   `src/lib/constants.ts` — next to the existing `CARRIERS` list at `:183-190`.
2. When disabled: hide the `Tracking` item from `nav-config.ts`, hide the
   `Tracking` tab and the tracking-related Quick actions on
   `order-detail-screen.tsx`, hide the `Tracking` row action in
   `orders-screen.tsx:364-366`, and hide the shipment entries from the command
   palette.
3. **Leave `Shipment`, `finance.ts`, the seed generator and the `/tracking`
   routes completely untouched**, so freight, customs duty, margin and the P&L
   keep producing identical numbers.

Actual deletion is a separate, later piece of work that must first decide where
freight and customs cost will live instead. Out of scope here (§6).

---

## 3. PHASE 2 — Manual fee, Afghani currency

### 3.1 The percentage calculation

`Order` already carries `serviceFeeType: "percent" | "fixed"` and
`serviceFeeValue` (`types.ts:123-125`), and `finance.ts:90-108` already handles
both branches:

```ts
const serviceFeeAfn =
  order.serviceFeeType === "percent"
    ? Math.round((itemsAfn * order.serviceFeeValue) / 100)
    : order.serviceFeeValue;
```

**The `"fixed"` branch is unreachable from the UI** — `new-order-screen.tsx:139`
and `seed.ts:601` both hardcode `serviceFeeType: "percent"`. So Phase 2 is
mostly *removing the percent path*, not building a new one.

Work required:

- Narrow `Order.serviceFeeType` to the literal `"fixed"`, or drop the field and
  rename `serviceFeeValue` → `serviceFeeAfn`. **Recommended: drop the field**,
  because a union with one member is noise. This makes `finance.ts:95-98` a
  plain read.
- Replace the `Fee %` input (`new-order-screen.tsx:272-284`) with a `Fee (AFN)`
  amount input.
- **Delete the duplicated percentage formula in two more places** —
  `new-order-screen.tsx:105` and `seed.ts:634` each re-implement
  `Math.round((itemsAfn * pct) / 100)` rather than calling `orderRevenue()`.
  These are a live divergence risk today.
- Remove `Client.serviceFeePercent` (`types.ts:41-42`), its input in
  `new-client-screen.tsx:219-234`, its read in `new-order-screen.tsx:83-92`,
  and its display in `client-detail-screen.tsx:239-250`.
- Remove `CompanyProfile.defaultServiceFeePercent` (`types.ts:288-289`) and its
  settings input (`company-settings-screen.tsx:156-171`).
- Fix the display label `Service fee ({order.serviceFeeValue}%)` at
  `order-detail-screen.tsx:294` and `invoice-document.tsx:138-139`.

**Migration path for existing percentage orders.** There is no persisted data
(§0), so this is a seed-data change, not a data migration: for each seeded order,
compute `Math.round((itemsAfn * serviceFeeValue) / 100)` once and store the
result as the flat amount. Historic totals stay byte-identical. If a database
lands before Phase 2 ships, this becomes a real backfill and must be re-specced.

### 3.2 Money representation — recommendation

**Recommendation: keep whole-AFN integers. Do not introduce minor units.**

Justification:

- The codebase is already integer-AFN throughout, by explicit design
  (`types.ts:8-13`), and `formatAfn()` (`format.ts:23-32`) rounds to zero
  fraction digits. Nothing currently produces a fractional AFN.
- The AFN's minor unit, the *pul* (1/100), is not in practical circulation.
  Storing `1400000` to mean 14,000 AFN buys no precision that anyone will use
  and makes every literal in the seed data and every input harder to read.
- The float risk the brief is right to worry about comes from *percentage
  arithmetic*, and Phase 2 deletes exactly that. Once the fee is a typed-in
  integer, the only operations left are integer `+`, `-` and `×` by integer
  quantity — all exact in IEEE-754 well beyond any realistic order total.

The one place a float survives is `FREIGHT_COST_RATIO = 0.75`
(`constants.ts:260`), used as `Math.round(order.shippingChargedAfn * 0.75)`
(`finance.ts:145-148`). It is `Math.round`ed immediately, so it is safe — but it
should be spelled `Math.round(x * 3 / 4)` to remove the float entirely.

**Rule to state in the code:** every `*Afn` field is a non-negative integer
number of whole Afghani; the only permitted operations are integer arithmetic
and `Math.round` at the boundary.

### 3.3 Optional USD reference fields — PROPOSAL ONLY, NOT APPROVED

Per the brief, proposed but **not to be built without explicit approval**:

```ts
/** Reference only. What we paid in USD, for the operator's own records. */
originalCostUsd?: number;
/** Reference only. The USD→AFN rate the operator used, typed in manually. */
fxRateUsed?: number;
```

Both purely informational: never read by `finance.ts`, never shown to a client,
never used to derive an AFN figure. No exchange-rate API, no hardcoded rate —
the operator converts manually and types the AFN amount, as specified.

---

## 4. PHASE 3 — Order creation form

### 4.1 What the form is today

`src/features/orders/new-order-screen.tsx` (574 lines, `"use client"`):

- **No `<form>` element.** Submit is a plain `<Button onClick={handleSubmit}>`
  (`:354`).
- **No react-hook-form, no zod.** Both are in `package.json` — `zod@^3.25.76`,
  `@hookform/resolvers@^5.7.1`, `react-hook-form@^7.85.0` — and **neither is
  imported anywhere in `src/features/`**. `src/components/ui/form.tsx` (the
  shadcn wrapper) is the only react-hook-form consumer and is itself unused.
  So the dependencies for a proper form already exist and are paid for.
- Validation is two lines (`:116-119`): a client must be selected and at least
  one item must have a name, `qty > 0` and `unitPriceAfn > 0`. Submit is
  disabled when invalid (`:354`) and one generic hint renders (`:358-362`).
- **Silent failure exists:** `handleSubmit` has `try`/`finally` and **no
  `catch`** (`:124-151`) — a rejected `createOrder` throws unhandled. Invalid
  item rows are silently dropped (only `validItems` are submitted).
- Sections today: `Client` → `Requested products` → `Internal note` →
  `Quotation` (sticky right rail).

### 4.2 Target

Regroup to the flow in the brief — **Client → Product → Money → Tracking** —
built on react-hook-form + a zod schema (both already dependencies, so no new
packages). Per-field inline errors, submit disabled until valid, and a real
`catch` that surfaces a toast instead of throwing.

The `Tracking` group shows the auto-generated `trackingNumber` (§2.2) read-only
with an "override" affordance.

**Do not lose** the cost→price auto-suggest at `:535-548`
(`Math.round((cost * 1.15) / 50) * 50`) — it encodes how the team actually
quotes. It survives Phase 2 because it operates on item prices, not the fee.

### 4.3 Product image upload — BLOCKED, needs a decision

**No upload mechanism and no storage exist** (§0). `OrderItem.imageUrl` is
declared (`types.ts:89`) and consumed by `ProductThumb`
(`product-thumb.tsx:72-81`), but **is never assigned a value anywhere in the
repo** — a grep across `src/lib/mock/` returns zero hits. Every product image in
the running app today is the local lucide-icon category placeholder.

Options, simplest first — **awaiting the owner's choice, nothing to be built
until then**:

1. **Base64 data URL into the in-memory store.** Zero infrastructure, works
   today, matches the frontend-first plan. `FileReader.readAsDataURL`, validate
   type and size client-side, store the string in `imageUrl`. Dies on reload
   like all other state. Right answer *only* as a stopgap — data URLs are
   unacceptable once a real DB exists.
2. **Vercel Blob** (`@vercel/blob`) — a new dependency, needs a token, but is
   the least-effort real storage if this deploys to Vercel.
3. **Local `public/uploads/` via a route handler** — needs the first API route
   in the repo, and does not survive most container deployments.

Whichever is chosen: accept `image/jpeg`, `image/png`, `image/webp`; cap at
5 MB per image; allow up to 4 images per item. Note that supporting several
images means `imageUrl?: string` becomes `imageUrls?: string[]`, touching all
six `ProductThumb` call sites.

### 4.4 Description field

`OrderItem` has `notes?: string` (`types.ts:100`) which renders admin-only in
italics (`order-detail-screen.tsx`). The brief wants a description visible to
admin **and** on the public page. Since `notes` is existing internal free text
that staff may already treat as private, **add a separate field** rather than
re-purposing it:

```ts
/** Client-facing product description. Shown on the public tracking page. */
description?: string;
```

---

## 5. PHASE 4 — UI / UX plan (spec only, build in a later session)

Work within the existing system: Tailwind v4 CSS-first tokens in
`src/app/globals.css` (`--brand-50…950` maroon, `--gold-50…900`, plus
`--success`, `--warning`, `--info`, `--teal`, `--purple`), shadcn/ui primitives
in `src/components/ui/`, three fonts loaded in `src/app/layout.tsx` via
`next/font/google` — `Inter` (`--font-inter`), `JetBrains_Mono`
(`--font-jetbrains-mono`), `Dancing_Script` (`--font-dancing-script`).
**No rewrite.**

### 5.1 Orders list — information hierarchy

Ten columns today (`orders-screen.tsx:164-388`): `Order`, `Client`, `Products`,
`Total (AFN)`, `Paid (AFN)` (hidden by default), `Balance (AFN)`,
`Profit (AFN)`, `Status`, `Created`, actions.

Someone working through orders needs: *which order, whose, what, where is it,
does anyone owe us money.* Profit is an accounting question, not an operations
one.

- **Add** `Tracking` as a visible column (it becomes the number clients quote
  over the phone — the primary lookup key).
- **Cut from default view** `Profit (AFN)` → move to the hidden set alongside
  `Paid (AFN)`. Both stay available via the column-visibility menu.
- **Merge** `Total` and `Balance` into one money column showing the total with
  the outstanding balance beneath it in `text-destructive` when non-zero —
  the same two-line treatment the `Order` and `Client` cells already use.
- **Status at a glance:** keep `StatusBadge`; the 12-value registry with
  distinct dot colours already reads well. Sort the default view by status
  priority rather than `requested` date, so `ready_for_pickup` surfaces.

### 5.2 Order detail layout

Above the fold: order number **and tracking number**, client, status badge,
status stepper, and the primary actions. Today the stepper is a full-width card
(`order-detail-screen.tsx:181-183`) directly under the header, which is right —
keep it.

- Timeline moves **out of the fifth tab**. Burying the chronology behind
  `Activity` is the main reason the orders area reads as confusing. Put it in
  the right rail below `Financial summary`, always visible, capped at ~5 entries
  with a "show all" expander.
- Actions consolidate: `Change status` stays primary in the header; the
  `Quick actions` card (`:706-758`) keeps only what is not already in the
  header.
- Tabs reduce from five to three once carrier tracking is hidden (§2.5):
  `Items`, `Purchases`, `Payments`.

### 5.3 One status treatment

`src/components/shared/status-badge.tsx` **already is** the single component,
with `StatusBadge` and `StatusDot` resolving through one `Registry` discriminated
union over `ORDER_STATUS`, `PURCHASE_STATUS`, `SHIPMENT_STATUS`, `PAYMENT_TYPE`,
`CLIENT_STATUS`. The colour mapping is already centralised in
`src/lib/constants.ts`.

The violations to fix are the places that **bypass** it — chiefly the raw
`{marginPercent.toFixed(0)}%` inline treatments in `orders-screen.tsx:291,301`
and any ad-hoc coloured text. Audit for `text-destructive` / `text-success`
applied directly to status-like values.

### 5.4 Navigation

Header is persistent via `AppShell` (`app-shell.tsx`) → `Topbar`. Current-page
state and breadcrumbs come from `use-page-meta.ts`, whose `STATIC` map
(`:39-73`) already covers `/orders`, `/orders/new` and dynamic order titles.

Gap: **no back affordance from detail to list.** The breadcrumb is in the topbar,
visually distant from the content. Add an explicit `← Orders` link at the top of
`PageHeader` on detail screens.

### 5.5 Missing states — the complete list

| State | Status |
|---|---|
| `loading.tsx` for any route | **missing** — none exist anywhere |
| `error.tsx` / `global-error.tsx` | **missing** — none exist anywhere |
| Order detail loading | **missing** — `useOrder` is synchronous against the store; will need one when the API is real |
| Order detail error (not 404) | **missing** — `notFound()` at `:87` is the only branch |
| Create-order submit failure | **missing** — no `catch` (`new-order-screen.tsx:124-151`) |
| Status-change failure | **missing** — no `catch` (`order-detail-screen.tsx:94-97`) |
| Public tracking "not found" | **missing** — page does not exist yet |
| Public tracking loading | **missing** — page does not exist yet |
| Orders list empty | **present** — `DataTable` `emptyTitle`/`emptyDescription` |
| Order detail tab empties | **present** — `EmptyState` on Purchases, Tracking, Payments |
| Skeleton component | **present but unused** — `src/components/ui/skeleton.tsx` exists; no screen imports it |

### 5.6 Mobile

`AppShell` already handles narrow screens: the desktop `Sidebar` is
`hidden shrink-0 lg:block` and a `Sheet` drawer carries the same `Sidebar` below
`lg`, closing on route change.

Unusable narrow today:

- **Orders list.** Ten columns in a `DataTable` with no responsive strategy —
  it overflows horizontally on a phone. This is the screen staff will use most.
  Needs a card layout below `md`, not a scrolling table.
- **Order detail.** The `xl:grid-cols-[1fr_320px]` split collapses acceptably,
  but the five-tab `TabsList` will not fit — another reason for §5.2's
  reduction to three.
- **New order form.** The three-across fee/shipping/discount grid
  (`new-order-screen.tsx:271`) is `grid-cols-3` unconditionally and will be
  cramped; the Phase 3 rebuild should fix it.
- **Print routes** are A4 by definition — out of scope.

### 5.7 Public tracking page — a deliberately separate surface

Different visual register from the admin app, on purpose: centred single column,
no sidebar, no density, large type, one card. Brand maroon and gold from the
existing tokens so it is recognisably Amanat, but none of the admin chrome. It
is the only screen a non-staff member ever sees. Optimise for a phone first.

---

## 6. PHASE 5 — Internal e-commerce (design sketch only, no code)

Later: list our own products internally, a customer taps Buy, we get notified,
we buy from Amazon/Daraz manually.

**Data model.** A new `CatalogItem` — distinct from the existing
`CatalogProduct` in `src/lib/mock/catalog.ts:8-17`, which is seed-generator
scaffolding, not a storefront entity:

```
CatalogItem: id, name, description, imageUrls[], priceAfn,
             category (reuse ProductCategory), storeId, active
BuyRequest:  id, catalogItemId, qty, customerName, customerPhone,
             createdAt, status: "new" | "converted" | "dismissed",
             convertedOrderId?
```

**Notification channels**, cheapest first: (a) an in-app badge on the sidebar,
reusing the `customsHolds` badge mechanism in `nav-config.ts:23,53` — zero
infrastructure; (b) email via a transactional provider; (c) WhatsApp Business
API — highest operational fit given `ContactChannel` is already
`whatsapp`-first, highest setup cost. Recommend (a) for v1, (b) when a backend
exists.

**Buy → Order.** A `BuyRequest` is a lead, not an order. An admin reviews it and
converts, which calls the existing `createOrder()` with
`source: "facebook" | "referral"` (or a new `OrderSource` member `"web"`),
one `OrderItem` built from the `CatalogItem`, and the manually-entered fee.
From that moment it is an ordinary `Order` — it gets a `trackingNumber` from
§2.2 and flows through the identical status lifecycle and public tracking page.
**No parallel tracking system.**

---

## 7. Out of scope

Explicitly **not** part of this work:

- Any backend, database, ORM, schema, migration or API route handler (D1).
- Authentication, authorization, user accounts, sessions, roles. `TeamMember`
  and `TeamRole` remain display-only data.
- Deleting `Shipment`, the `/tracking` routes, `label-document.tsx`,
  `packing-list-document.tsx`, or the `CARRIERS` list (§2.5 — isolation only).
- Changing how freight or customs cost is modelled in `finance.ts`.
- Building the USD reference fields (§3.3 — proposal awaiting approval).
- Building any image upload before the storage decision is made (§4.3).
- Dari / Pashto translation and RTL layout. **Nothing exists today**: the app is
  `<html lang="en">` with no i18n library, no locale handling and no `dir`
  attribute. Retrofitting RTL touches every directional Tailwind utility in the
  codebase and must be its own project. Flagged in §8 as an open question
  because it changes how Phase 4 should be built if it is coming soon.
- Any Phase 4 implementation (spec only, per the brief).
- Any Phase 5 implementation (design sketch only, per the brief).
- Repairing anything in the expense-categories feature beyond what TASK 0 needs
  to make the build green.

---

## 8. Risks and open questions

### Risks

| # | Risk | Severity |
|---|---|---|
| R1 | **The public tracking page cannot be secure while frontend-only.** The whole dataset ships to the browser; rate limiting is not implementable; the projection controls rendering, not exposure. Must not be deployed publicly before the backend. (§2.4) | **High** |
| R2 | **The baseline does not build.** 24 type errors and a failing `npm run build` on `main`, from a half-landed expense-categories feature. Blocks per-task verification until TASK 0 lands. (§0.2) | **High** |
| R3 | **Tracking-number uniqueness is unenforceable.** No DB. Phase 1 checks against an in-memory array that resets on reload. Collision probability is negligible; the *guarantee* is absent. (§2.2) | Medium |
| R4 | **Carrier isolation leaves dead weight.** `Shipment`, the seed generator and the `/tracking` routes stay live behind a flag; `finance.ts` keeps reading freight and customs from shipments. Anyone reading the code will find a tracking system the product says does not exist. Deliberate — the alternative silently changes every margin figure. (§2.5) | Medium |
| R5 | **Nothing persists.** Every demo of tracking numbers, statuses and uploaded images resets on reload. Expect this to be mistaken for a bug during review. | Medium |
| R6 | **No tests exist.** Every verification step in TASKS.md is a manual UI action or a typecheck/build/lint run. There is no regression net for the `finance.ts` changes in Phase 2. | Medium |
| R7 | **The fee formula is duplicated three times** (`finance.ts:95-98`, `new-order-screen.tsx:105`, `seed.ts:634`). Phase 2 must change all three or the quotation preview will disagree with the saved order. | Low |

### Open questions — need answers before the phase they block

1. **§4.3 — image storage.** Which of the three options? Blocks Phase 3. *(The
   brief says to wait for this choice; nothing will be built until it is made.)*
2. **§3.3 — USD reference fields.** Build them or not? Blocks nothing; defaults
   to "not built".
3. **§7 — Dari / Pashto + RTL.** Is this coming within ~6 months? If yes, Phase 4
   should avoid directional utilities (`ml-`, `pr-`, `text-left`) in favour of
   logical ones (`ms-`, `pe-`, `text-start`) as it goes, which is nearly free
   now and expensive later. If no, ignore entirely.
4. **§0.2 — TASK 0 scope.** Repair the expense-categories feature by *building*
   the missing data layer, or by *reverting* the two screens to a working state?
   Reverting is smaller and faster; building is more work but keeps the feature.
5. **§2.2 — tracking number on existing orders.** Confirmed there is no
   persisted data, so this is a seed change. If a DB lands before Phase 1 ships,
   re-spec as a real backfill.
