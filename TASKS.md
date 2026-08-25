# Amanat Shopping — where the build stands

Everything in `SPEC.md` that was scheduled for this round is built, on the
database, and merged to `main`. This file is the honest picture: what is done,
what is knowingly unfinished, and what is a decision waiting on you rather than
work waiting on a developer.

**The standing check.** All four must be clean before anything counts as done:

```bash
npm run typecheck    # exit 0, no output
npm run lint         # 0 errors (1 pre-existing warning in data-table.tsx is expected)
npm run build        # exit 0
npm test             # 51 passing, 0 failing (needs DATABASE_URL pointed at a scratch database)
```

---

## Done

**Operations.** Clients, orders, purchases, payments and settings all live in
Postgres and are read and written through server actions. Order status,
including `on_hold`, changes with a note recorded against it. A purchase can
change status after it is logged.

**Tracking.** Internal only, no carrier involved — per `CLAUDE.md`. Tracking
numbers are minted under an advisory lock inside the writing transaction, are
unique at the database level, and can be overridden by an admin. The public
`/track` page answers for both website orders and operations orders, and reads a
projection built by naming what a customer may see rather than by removing what
they may not, so a column added to `orders` tomorrow is absent there by default.

**The shop.** A storefront customers can browse, search and filter; a product
page with a multi-photo gallery; a basket and checkout that writes a real order
and notifies you. Its admin lives at `/shop`, apart from operations.

**Accounts.** One login per person, scrypt-hashed, database-backed sessions
storing only the SHA-256 of the cookie token, lockout after repeated failures.
First run takes you to `/setup` to create the owner.

**Money.** Afghani only, stored as whole integers named `*_afn`. No currency
conversion anywhere, no `$`, no exchange-rate API — per `CLAUDE.md`. Amounts are
typed in by an admin, and nothing is guessed on their behalf.

**The database bringing itself up.** A deploy migrates before it builds, and if
that did not happen the first request creates the schema itself. Neither path
uses a session advisory lock, which cannot work over a transaction pooler —
which is what both Neon and Supabase put in front of the database. See
`DATABASE.md`, "Creating the tables", for why that distinction cost a week.

---

## Knowingly unfinished

### 1. Product photos live inside database rows

Images are resized to ~150KB and stored as data URLs in `product_images.url`.
Fine at a few hundred products; wrong at a few thousand, because the image
travels inside every query that reads the product.

The fix is object storage — upload returns a URL, `url` stops being a data URL,
and nothing that reads it changes. Vercel Blob is the obvious choice given where
this is hosted. It needs a new dependency, and `CLAUDE.md` says not to add one
without asking.

Not urgent: the decision so far is to run the shop without photographs at all,
and the storefront is laid out to read well that way — no placeholder squares,
no empty frames.

### 2. Staff roles do not restrict anything

The `team_role` enum (`owner` / `manager` / `staff`) exists, `requireRole()` in
`src/lib/auth/session.ts` is written and works — and nothing calls it. Every
signed-in person can currently do everything: delete a client, erase the
database, change any price.

That is fine while you are the only account. It stops being fine the moment you
add someone. Deciding which actions each role may take is a business question,
not a technical one, so it is left for you to answer rather than guessed at.

### 3. Two order-form items from the original plan

Neither blocks anything; both were overtaken by the backend work.

- A client-facing `description` on an order item, separate from the internal
  `notes`. `variant` covers most of what it was for.
- Rebuilding the create-order form as a grouped Client → Product → Money →
  Tracking flow with react-hook-form and zod (both already in `package.json`).
  The form works and validates; this was about making a long form feel shorter.

---

## Waiting on you, not on code

- **Fill in Settings → Company.** Phone, WhatsApp, email and street are blank,
  and they print on every invoice and show on the public tracking page.
- **Confirm the database password was rotated.** It was pasted into a chat
  transcript. It appears in no file and no commit — that was checked — but a
  transcript is not private storage. Reset it in the database console, then
  update the connection string in Vercel.
- **Keep using the pooled connection string.** On Neon that is the host with
  `-pooler` in it, and it needs `sslmode=require`.

---

## Later, by design

`SPEC.md` §5 (UI/UX pass) and §6 (internal e-commerce) were specified but
deliberately not built in this round.
