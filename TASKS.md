# Amanat Shopping — Task Checklist

Ordered. One task = one reviewable change. A task is done only when its
verification step has actually passed with real output.

Written against `SPEC.md` at commit `69716d4`. Section references (§) point into
`SPEC.md`.

**Standing check after every task** — all three must be clean before the task
counts as done:

```bash
npm run typecheck    # expect: exit 0, no output
npm run lint         # expect: 0 errors (1 pre-existing warning in data-table.tsx is OK)
npm run build        # expect: exit 0
npm test             # expect: # pass 4, # fail 0
```

`SPEC.md` §0 recorded that no tests existed. That is no longer true: PR #1
added a Playwright header regression suite and the `typecheck` / `test` npm
scripts, so all four commands above apply from TASK 0 onwards.

---

## TASK 0 — Repair the baseline — ✅ DONE (via PR #1)

`main` did not typecheck and did not build (`SPEC.md` §0.2).

This turned out to be already fixed by an open, unmerged pull request —
**PR #1, "Fix the build on main, add a header regression test and CLAUDE.md"**
(branch `fix/persistent-header`). Its root-cause note: the orphaned expense
screens "came back when a zip was extracted over the repository: an extract
adds and overwrites, it cannot delete."

So the answer was neither of the two options originally posed here (build the
missing data layer / revert the screens) — it was *merge the fix that already
existed*. PR #1 deletes the four orphaned files and additionally adds the
`typecheck` and `test` npm scripts plus a 4-case Playwright header regression
test, which is the harness the per-task verification below relies on.

- [x] **0.1 — Merge PR #1** — merged as `55e7018`.

  **Verified:**
  ```
  npm run typecheck   → exit 0   (was: 24 errors)
  npm run build       → succeeds (was: failing)
  npm test            → # pass 4  # fail 0  (was: no tests at all)
  ```

---

## PHASE 1 — Our own manual tracking

### 1.1 — Add the `on_hold` order status

- [x] Add `"on_hold"` to the `OrderStatus` union in `src/lib/types.ts:51-62`.
      In `src/lib/constants.ts`: add the `ORDER_STATUS` entry
      (`meta("on_hold", "On hold", "warning", "bg-warning")`), add `on_hold` to
      `ACTIVE_ORDER_STATUSES`, leave `ORDER_PIPELINE`, `ORDER_TERMINAL` and
      `BILLABLE_ORDER_STATUSES` unchanged, and export
      `ORDER_HOLD: OrderStatus[] = ["on_hold"]`.

  Files: `src/lib/types.ts`, `src/lib/constants.ts`.

  **Verify:** `npx tsc --noEmit` → no output. (`ORDER_STATUS` is a
  `Record<OrderStatus, …>`, so a missing entry is a compile error — this is the
  real check.)

### 1.2 — Show `on_hold` in the status-change dropdown

- [x] Render `ORDER_HOLD` as a third group in the `Change status` dropdown,
      between the `ORDER_PIPELINE` group and the destructive `ORDER_TERMINAL`
      group.

  Files: `src/features/orders/order-detail-screen.tsx` (the `DropdownMenu` at
  `:129-165`).

  **Verify:** open any order detail page → click **Change status** → "On hold"
  appears as its own group, is not styled destructive, and selecting it sets the
  header badge to a warning-toned "On hold".

### 1.3 — Add a note field to the status change

- [x] The dropdown currently calls `updateOrderStatus(order.id, next)` with no
      note, so every timeline entry reads the default
      `"Updated from the order page."` (`src/lib/api/mutations.ts:209`). Add an
      optional note captured at status-change time and pass it as the third
      argument.

  Files: `src/features/orders/order-detail-screen.tsx`.
  Do **not** change `updateOrderStatus` — it already accepts `note?`.

  **Verify:** change a status with a note typed in → the Activity tab's newest
  timeline entry shows that note text, not "Updated from the order page."

### 1.4 — Add `trackingNumber` to the domain model

- [x] Add required `trackingNumber: string` to `Order` (`src/lib/types.ts:112-132`).
      Add a generator producing `AS-YYYY-XXXXXX` over the
      `0123456789ABCDEFGHJKMNPQRSTVWXYZ` alphabet (`SPEC.md` §2.2), used by
      `createOrder()` with regeneration on collision against the existing
      `orders` array. Update `src/lib/mock/seed.ts` to mint one per seeded order.

  Files: `src/lib/types.ts`, `src/lib/api/mutations.ts` (`createOrder`,
  `:147-190`), `src/lib/mock/seed.ts`.

  **Verify:** `npx tsc --noEmit` → no output. (Declaring the field required makes
  every construction site a compile error until updated — that is the check.)

### 1.5 — Show the tracking number on the order detail screen

- [x] Display `order.trackingNumber` prominently in the `PageHeader` area,
      alongside `orderNo`, with a copy-to-clipboard affordance.

  Files: `src/features/orders/order-detail-screen.tsx`.

  **Verify:** open any order → the tracking number renders in
  `AS-YYYY-XXXXXX` form and differs from the `AS-YYYY-NNNN` order number.

### 1.6 — Let the admin override the tracking number

- [x] Add an edit affordance that calls the existing
      `updateOrder(id, { trackingNumber })` (`src/lib/api/mutations.ts:222-229`).
      Reject a value already used by another order, and reject one that does not
      match `^AS-\d{4}-[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{6}$`.

  Files: `src/features/orders/order-detail-screen.tsx`,
  `src/lib/api/mutations.ts` (uniqueness guard).

  **Verify:** edit an order's tracking number to one already held by another
  order → the save is rejected with a visible message and the stored value is
  unchanged.

### 1.7 — Search orders by tracking number

- [x] Add `order.trackingNumber` to the search haystack at
      `src/features/orders/orders-screen.tsx:151-153`, update the `SearchInput`
      placeholder from `"Search order no, client or product…"`, and add the same
      to the command-palette index at `src/lib/api/queries.ts:813`.

  Files: `src/features/orders/orders-screen.tsx`, `src/lib/api/queries.ts`.

  **Verify:** copy a tracking number from an order detail page → paste it into
  the orders-list search → exactly that one order remains in the table.

### 1.8 — Add a `Tracking` column to the orders list

- [x] Add a visible `trackingNumber` column to the `columns` memo
      (`src/features/orders/orders-screen.tsx:164-388`).

  **Verify:** load `/orders` → the Tracking column renders a value for every
  row, and the column-visibility menu lists it.

### 1.9 — Public tracking projection (data layer only, no UI)

- [x] Add `PublicTrackingResult` and `usePublicTracking(trackingNumber)` to
      `src/lib/api/queries.ts`, exported from `src/lib/api/index.ts`. The result
      object must contain **only** the allowlist in `SPEC.md` §2.4. The timeline
      maps each `OrderEvent` to `{ at, statusLabel }` using
      `ORDER_STATUS[…].label` — never `OrderEvent.title`, `.description` or
      `.actor`. Unknown numbers return `null`.

  Files: `src/lib/api/queries.ts`, `src/lib/api/index.ts`.

  **Verify:** `npx tsc --noEmit` → no output, and read the returned object
  literal to confirm it names no field outside the §2.4 allowlist. This is a
  code-review check — it is the security boundary.

### 1.10 — Public tracking page

- [x] Create the route group and page: `src/app/(public)/layout.tsx` (no
      `AppShell`, mirroring `src/app/(print)/layout.tsx`) and
      `src/app/(public)/track/page.tsx`, plus the screen component under
      `src/features/tracking/` (or a new `src/features/public/`). Input for the
      tracking number, then product image (`ProductThumb`), product name,
      quantity, current status, timeline, and an explicit "arrived at office"
      indicator. Invalid and unknown numbers both render the **same** generic
      not-found — no distinction, no timing difference in the rendered result.

  **Verify:** visit `/track` → it renders with no sidebar and no topbar → enter
  a real tracking number → the product, status and timeline appear → enter
  `AS-2026-XXXXXX` and a malformed string → both produce the identical
  not-found message.

### 1.11 — Isolate carrier tracking behind a flag

- [x] Add `CARRIER_TRACKING_ENABLED` to `src/lib/constants.ts` (reading
      `NEXT_PUBLIC_CARRIER_TRACKING_ENABLED`, defaulting to `false`). When
      disabled, hide: the `Tracking` nav item
      (`src/components/layout/nav-config.ts`), the `Tracking` tab and the
      tracking-related Quick actions (`order-detail-screen.tsx`), the `Tracking`
      row action (`orders-screen.tsx:364-366`), and shipment entries in
      `src/components/layout/command-palette.tsx`.

      **Do not touch** `src/lib/types.ts` (`Shipment`), `src/lib/finance.ts`,
      `src/lib/mock/seed.ts`, or the `/tracking` routes — `SPEC.md` §2.5
      explains why deleting them silently changes every margin figure.

  **Verify:** with the flag unset, load `/orders` and an order detail page →
  no Tracking nav item, tab or row action anywhere → then confirm the order's
  **Profit** and **Margin** figures are byte-identical to before the change
  (screenshot or note them first).

---

## PHASE 2 — Manual fee, Afghani currency

> Do not start until Phase 1 is merged.

### 2.1 — Convert the service fee to a manual AFN amount

- [ ] Drop `Order.serviceFeeType` and rename `serviceFeeValue` →
      `serviceFeeAfn` (`SPEC.md` §3.1). Simplify `orderRevenue()`
      (`src/lib/finance.ts:90-108`) to read the amount directly.

  Files: `src/lib/types.ts`, `src/lib/finance.ts`.

  **Verify:** `npx tsc --noEmit` → no output (the rename makes every reader a
  compile error, which is the point).

### 2.2 — Remove the two duplicated percentage formulas

- [ ] `src/features/orders/new-order-screen.tsx:105` and
      `src/lib/mock/seed.ts:634` each re-implement
      `Math.round((itemsAfn * pct) / 100)`. Replace both with the stored amount.
      For seed data, compute the amount once so historic totals do not move.

  **Verify:** load `/finance` and note the service-fee total, then reload →
  the figure is unchanged from the pre-change value (record it first).

### 2.3 — Replace the `Fee %` input with a `Fee (AFN)` amount input

- [ ] `src/features/orders/new-order-screen.tsx:272-284`. Relabel, and remove
      the client-rate prefill effect at `:83-92`.

  **Verify:** create an order, type `2500` as the fee → the Quotation rail's
  "Service fee" line reads 2,500 AFN, not a percentage of the items subtotal.

### 2.4 — Remove the per-client and company-default fee percentages

- [ ] Remove `Client.serviceFeePercent` (`src/lib/types.ts:41-42`) and
      `CompanyProfile.defaultServiceFeePercent` (`:288-289`), plus their inputs
      and displays in `src/features/clients/new-client-screen.tsx:219-234`,
      `src/features/clients/client-detail-screen.tsx:239-250`,
      `src/features/settings/company-settings-screen.tsx:156-171`, and their
      values in `src/lib/mock/clients.ts` and `src/lib/mock/settings.ts:24`.

  **Verify:** `npx tsc --noEmit` → no output; and `/settings` shows no
  "Default service fee %" field.

### 2.5 — Fix the percentage-suffixed fee labels

- [ ] `src/features/orders/order-detail-screen.tsx:294` and
      `src/features/print/invoice-document.tsx:138-139` render
      `Service fee ({order.serviceFeeValue}%)`. Drop the `%` suffix.

  **Verify:** open an order and its printed invoice → both read "Service fee"
  with no percentage in the label.

### 2.6 — Remove the last float from the money path

- [ ] `FREIGHT_COST_RATIO = 0.75` (`src/lib/constants.ts:260`), used at
      `src/lib/finance.ts:145-148`. Express as integer arithmetic
      (`Math.round(x * 3 / 4)`) per `SPEC.md` §3.2.

  **Verify:** `npx tsc --noEmit` → no output, and an order's Freight figure is
  unchanged from before.

---

## PHASE 3 — Order creation form

> **BLOCKED** on the image-storage decision (`SPEC.md` §4.3, open question 1).
> Tasks 3.1–3.2 can proceed without it; 3.3–3.4 cannot.

### 3.1 — Add a client-facing `description` to order items

- [ ] Add `description?: string` to `OrderItem` (`src/lib/types.ts:83-101`),
      separate from the existing internal `notes`. Surface it in the create form
      and on the order detail Items tab, and add it to `PublicTrackingResult`
      (§1.9).

  **Verify:** create an order with a description → it appears on the order
  detail page and on `/track` for that order's tracking number.

### 3.2 — Rebuild the create-order form as a grouped flow

- [ ] Restructure to **Client → Product → Money → Tracking** using
      react-hook-form + zod (both already in `package.json` — no new
      dependencies). Add per-field inline errors, keep submit disabled until
      valid, and add the missing `catch` to `handleSubmit`
      (`src/features/orders/new-order-screen.tsx:124-151`) so a failed
      `createOrder` shows a toast instead of throwing.

      Preserve the cost→price auto-suggest at `:535-548`.

  **Verify:** submit the form with an empty product name → an inline error
  appears on that field and submit stays disabled; no silent drop of the row.

### 3.3 — Image upload *(blocked on §4.3 decision)*

- [ ] Implement the chosen storage option. Validate type
      (`image/jpeg|png|webp`) and size (≤5 MB), up to 4 images per item. If
      multiple images are supported, `imageUrl?: string` becomes
      `imageUrls?: string[]`, touching all six `ProductThumb` call sites.

  **Verify:** upload a 6 MB file → rejected with a visible size error; upload a
  valid JPEG → the thumbnail renders on the order detail Items tab.

### 3.4 — Show the product image on the public tracking page *(blocked on 3.3)*

- [ ] Wire the uploaded image through `PublicTrackingResult` into `/track`.

  **Verify:** an order with an uploaded image shows that photo at `/track`;
  one without shows the existing `ProductThumb` category placeholder.

---

## PHASE 4 — UI / UX pass

> Spec only in this round (`SPEC.md` §5). Do not implement. Gets its own session.

---

## PHASE 5 — Internal e-commerce

> Design sketch only (`SPEC.md` §6). No code, not now.
