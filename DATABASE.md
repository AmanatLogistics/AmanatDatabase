# The database

Postgres, reached through [Drizzle](https://orm.drizzle.team). The schema lives
in `src/db/schema.ts`; the SQL that creates it lives in `drizzle/` and is
committed, so you can read exactly what runs.

Signing in already runs on it. The rest of the data moves across in the next
stage.

## Setting up Supabase

You have to do this part; I cannot create an account for you.

1. Go to **supabase.com**, sign up, and create a project. Pick a region close
   to Kabul — **Frankfurt (eu-central-1)** is the nearest sensible one. Save the
   database password it gives you; it is shown once.
2. In the project, go to **Project Settings → Database → Connection string**.
   You need **two** of the strings there:
   - **Transaction pooler**, port `6543` — this is the one the app uses. It
     survives serverless, where each request may arrive on its own instance.
   - **Session pooler** or **Direct connection**, port `5432` — this is the one
     migrations use. Creating tables needs a connection that stays put.
3. In **Vercel → your project → Settings → Environment Variables**, add:

   | Name           | Value                                   | Environments |
   | -------------- | --------------------------------------- | ------------ |
   | `DATABASE_URL` | the **transaction pooler** string, 6543 | all three    |

   Replace `[YOUR-PASSWORD]` in the string with the password from step 1.

## Creating the tables

Once, and again whenever a migration is added:

```bash
DATABASE_URL="<the session string, port 5432>" npm run db:migrate
```

It prints what it is about to apply and what it recorded. It is safe to run
twice — already-applied migrations are skipped.

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
