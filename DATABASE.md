# The database

Postgres, reached through [Drizzle](https://orm.drizzle.team). The schema lives
in `src/db/schema.ts`; the SQL that creates it lives in `drizzle/` and is
committed, so you can read exactly what runs.

All of it runs on this now — clients, orders, purchases, payments, the shop and
the staff logins. Nothing is kept in the browser.

## Setting up Neon

This project runs on Neon. It is ordinary Postgres, so nothing in the code is
tied to it — but these are the steps that match what you actually have.

1. Add it from **Vercel → your project → Storage → Create Database → Neon**, or
   sign up at **neon.com** and connect the project afterwards. Pick a region
   close to Kandahar — **Frankfurt (`eu-central-1`)** is the nearest sensible
   one.

2. **If you added it through Vercel, you are done.** The integration writes the
   environment variables for you, and the app already reads the two that matter:

   | Variable                | What it is        | What it is used for  |
   | ----------------------- | ----------------- | -------------------- |
   | `DATABASE_URL`          | pooled connection | serving every page   |
   | `DATABASE_URL_UNPOOLED` | direct connection | running migrations   |

   There is nothing to rename and nothing to paste. If you ever set
   `DATABASE_URL` by hand it wins over everything else.

3. **If you are wiring it up yourself,** copy the connection string from the
   Neon console and set it as `DATABASE_URL` in **Vercel → Settings →
   Environment Variables**, for all three environments. Use the **pooled**
   string — its host has `-pooler` in it:

   ```
   postgresql://<user>:<password>@ep-xxxx-pooler.eu-central-1.aws.neon.tech/<db>?sslmode=require
                                          ^^^^^^^
   ```

   Keep `?sslmode=require`. Neon refuses connections without it.

### Two things about Neon worth knowing

**It goes to sleep.** On the free plan the compute suspends after a few minutes
with no traffic, and the next request wakes it. That first request is slower —
usually under a second, occasionally a few. It is not a fault, and the ten
second connect timeout in `src/db/index.ts` leaves room for it. If a page ever
seems to hang on the first load of the day, this is why.

**Its pooled endpoint is a transaction pooler.** Same as Supabase's, and it
carries the same trap: session state does not survive between statements,
because each one may be handed to a different backend. That is why
`prepare: false` is set on the connection and why nothing here takes a session
advisory lock — see "Creating the tables" below, which is the whole story.

### If you are on Supabase instead

Also supported, no code change — but two extra traps, neither of which applies
to Neon:

- The direct host, `db.<ref>.supabase.co`, is **IPv6-only** and Vercel's
  functions are IPv4-only, so it fails with `getaddrinfo ENOTFOUND` on a
  hostname that is perfectly correct. Use a pooler string
  (`aws-0-<region>.pooler.supabase.com`).
- The pooler's **username is different** — `postgres.<project-ref>`, not plain
  `postgres`. Copying only the host across is the usual second mistake.

Supabase's Vercel integration names its variables `POSTGRES_URL` and
`POSTGRES_URL_NON_POOLING`, never `DATABASE_URL`. Both are read automatically.

### Every name the app looks for

In order, first one set wins:

- **App:** `DATABASE_URL`, `POSTGRES_URL`, `SUPABASE_DATABASE_URL`
- **Migrations:** `DIRECT_DATABASE_URL`, `DATABASE_URL_UNPOOLED`,
  `POSTGRES_URL_NON_POOLING`, then the app list

## Checking it works

```bash
npm run db:check
```

It lists which connection variables are present (passwords masked), says which
one the app would use, connects, counts the tables and tells you whether anyone
has an account yet. To check against what your deployment actually has:

```bash
npx vercel env pull .env.local && npm run db:check
```

## Creating the tables

**This happens on its own, twice over.**

1. **At deploy.** Every production deploy runs the migrations before building.
2. **At runtime, if that did not happen.** The first request to touch the
   database checks whether the tables exist and creates them if they do not.

The second exists because the first can be missed — the connection string
arrived after the build, the database was swapped, a preview was promoted. Miss
it and every page used to answer `relation "staff" does not exist`: a 500 with
no clue in it, on the first visit, before there was even an account to sign in
with. Now the app brings its own schema up and carries on. Watch for this line
in the runtime log:

```
[amanat] The database has no tables. Applying migrations now — this normally happens at build time.
[amanat] Migrations applied.
```

Several functions waking at once cannot corrupt this. Drizzle applies the
migration inside a transaction, so of two instances racing, one commits and the
other rolls back whole, looks again, finds the tables and carries on.

> **Not an advisory lock — and this matters.** An earlier version took
> `pg_advisory_lock` around the migration. That is safe on a direct connection
> and quietly catastrophic over a transaction pooler, which is what Supabase
> gives you and what this app is told to use. The pooler routes each statement
> to whichever backend is free, so the lock is taken on one server session and
> the unlock is asked of a different one — which does not own it and refuses.
> Postgres even says so: *"you don't own a lock of type ExclusiveLock"*. The
> lock then belongs for ever to a pooled backend nobody can reach, and
> everything that later asks for it waits without end: a build that hangs and
> applies no migrations, a request that dies when the platform's clock runs out,
> and no error anywhere explaining why. If you ever see a migration hang with no
> output, look for a stranded lock — `npm run db:check` reports them.

Look for the deploy-time run in the Vercel build log:

```
Using DATABASE_URL -> postgresql://postgres@db.xxxx.supabase.co:6543/postgres
2 migration(s) on disk:
  - 0000_init
  - 0001_staff_lockout

Done. 2 migration(s) recorded as applied.
```

Three things that can happen there, all deliberate:

- **No connection string configured** — it says so in the log and the build
  carries on. That keeps a local `next build` working without a database.
- **A connection string that does not work** — the deploy **fails**. Shipping an
  app whose tables do not exist helps nobody, and a failed deploy is a much
  clearer signal than a working page that errors on every click.
- **Two deploys at once** — one wins, the other's transaction rolls back, it
  looks again and finds there is nothing left to apply.
- **A preview deploy** — skipped. There is only one database, and preview
  builds share it: applying a migration from an unmerged branch would change
  production's shape before anybody reviewed it. Schema changes belong to the
  deploy that ships them.

To run it by hand anyway — after adding a migration locally, say:

```bash
npm run db:migrate
```

Safe to run twice; already-applied migrations are skipped.

### If a migration hangs

Almost always a lock left behind by a pre-2026 deploy of this app (see the note
above). `npm run db:check` lists any that are still held:

```
1 advisory lock(s) still held:
  pid 7031  idle  for 30s
```

Nothing here takes one any more, so a leftover is harmless to the running app —
but it will sit in the database until somebody ends the session holding it:

```bash
npm run db:check -- --clear-locks
```

## Working on it locally

```bash
cp .env.example .env.local     # then put a connection string in it
npm run db:generate            # after editing src/db/schema.ts
npm run db:migrate             # apply what was generated
npm run db:studio              # browse the data in a local UI
```

`.env.local` is gitignored. Never commit a connection string: it contains the
password, and anyone holding it has your customers' data.

## What the schema guarantees

These are the things the browser-only version could not promise, each covered by
a test in `tests/db.test.mts`:

- **A tracking number can only be issued once.** Two operators on two machines
  could previously mint the same one and neither would ever know.
- **So can an order number, a purchase number, a receipt number, a product slug
  and a staff email.**
- **Deleting an order takes its items, timeline, purchases and payments with
  it** — money is never left attributed to nothing.
- **Deleting a client takes their orders.**
- **Every money column is an `integer`** — whole Afghani. No column anywhere can
  hold a fraction, so no amount can drift.
- **A status outside the pipeline is refused** by the database, not just by the
  form.

Run them against a throwaway database:

```bash
DATABASE_URL="postgresql://…" npm test
```

Without `DATABASE_URL` they skip rather than fail, so `npm test` still works on
a fresh clone.

## Two deliberate differences from `src/lib/types.ts`

`src/lib/types.ts` stays the contract the UI reads. Two things are stored
differently from how the UI states them, both to avoid floats:

- `OrderItem.weightKg` is stored as `weight_grams`, an integer.
- `Purchase.orderItemIds` is a join table (`purchase_items`) rather than an
  array, so the database can enforce that every line referenced exists.

The conversion between the two sits in one place, next to the money conversions.

## Signing in

Staff accounts live in the `staff` table and sessions in `sessions`. There is no
password anywhere in the code and no shared login.

### The first account

Open the app with an empty database and it sends you to **`/setup`**, which
creates the owner account and signs you in. That page then stops existing —
once anyone owns the app, there is no way in without a password.

If you ever need to start again, delete the rows and the setup page comes back:

```sql
TRUNCATE staff CASCADE;
```

### What is protected

Everything except the storefront (`/store`), customer tracking (`/track`), and
the two login pages. That includes printed invoices, which carry a client's name
and address.

Two checks, not one:

- **`proxy.ts`** redirects a visitor with no session cookie to the login page.
  It is a convenience — it only looks at whether a cookie exists, and anyone can
  set a cookie.
- **`requireStaff()`** in every protected layout asks the database. That is the
  check that counts, and every server action that touches data will call it too.

### How the session works

The cookie holds a random token. The database stores only its SHA-256, so a leak
of the `sessions` table cannot be replayed as somebody's login. Signing out
deletes the row, which ends that session in every browser holding it — the
reason sessions are in the database rather than inside a signed cookie. Deactivate
an account and its existing sessions stop working on the next request.

Passwords are hashed with scrypt from Node's standard library, cost parameters
stored alongside each hash so they can be raised later without locking anyone
out.

### Against guessing

Eight wrong passwords locks an account for 15 minutes. The counter is a column
on the row, not a number in memory, because the app runs on serverless instances
that do not share memory — an in-process counter would reset itself constantly
and protect nothing.

A wrong password and an email that does not exist return the same message, and
take the same time, so the login cannot be used to find out which of your staff
emails are real.

## What runs on the database now

**The shop.** A customer's order reaches you rather than sitting in their
browser:

- **Products** are stored in the database. The shop admin writes them; the
  storefront reads them, server-rendered, so a stranger sees what you published
  rather than an empty page.
- **Cost prices never leave the server.** `PublicProduct` is built by naming
  what a customer may have, not by deleting what they may not — a column added
  to the schema later is absent from it by default rather than leaking until
  somebody remembers.
- **Checkout writes a real order** and raises a notification **in the same
  transaction**, so there is no version of events where an order exists that
  nobody was told about.
- **Prices are read server-side.** The basket sends product ids and quantities;
  a caller who sends their own price is describing a product we do not sell.
- **The bell polls** every 30 seconds and on returning to the tab. A shop takes
  a handful of orders a day, and a websocket for that is a connection to keep
  alive on a platform that does not want to hold one.
- **Tracking runs on the server**, so a customer on their own phone can look up
  their reference. It returns a status, a progress position and item names —
  never a phone number, an address, or a price you paid.

**The operations database.** Clients, orders, purchases, payments and the
settings all live in Postgres:

- **Two people, two machines, one set of records.** What one member of staff
  enters, the other sees. This is the whole point, and it was the one thing the
  app could not do.
- **Every write records who made it**, taken from the session rather than from
  the browser — a caller who could name the actor could name somebody else.
- **Reference numbers are allocated under a lock** inside the transaction that
  uses them, so two operators creating an order in the same second cannot be
  handed the same one.
- **Updates take an allow-list, not a patch.** These are POST endpoints:
  whatever is spread into an `UPDATE` is whatever the caller chose to send, so a
  column is editable only by being named. Status and tracking number have their
  own actions, because both do more than write a column.
- **A customer can track a real tracking number** from their own phone. They get
  a status, a position on five stages and item names — never the client record,
  the phone number, the address, what we paid, or the margin.

### How the app reads it

The browser keeps a copy in memory as a cache, loaded once per page and reloaded
after every write. Screens read the cache, so they did not have to change.

What the cache does **not** do is notice somebody else's change while you sit on
a page — for that, reload. A shop where two people edit the same order in the
same minute would need more than this; this one does not.

**Only the basket is persisted in the browser now.** It is genuinely the
visitor's own. Everything else would be a second version of the truth, read
before the server answered.
