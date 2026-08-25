import { NextResponse } from "next/server";
import { sql as raw } from "drizzle-orm";

import { db } from "@/db";
import { APP_URL_VARS, DIRECT_URL_VARS, describeUrl, findDatabaseUrl } from "@/db/url";
import { readSession } from "@/lib/auth/session";

/**
 * What is actually wrong with the database, measured rather than guessed.
 *
 * Every diagnosis in this app so far has come from reading code and reasoning
 * about it, which has been wrong as often as right — a paused project that was
 * healthy, a schema check that was fine. The deployment is the only place the
 * answer lives, and its logs are not always reachable. So the app reports on
 * itself: each step of a dashboard load, timed, in order, with the first
 * failure quoted verbatim.
 *
 * **Signed in only.** It names environment variables and quotes driver errors,
 * neither of which belongs to the public. Passwords are never included — every
 * connection string goes through `describeUrl`, which drops them.
 *
 * Open `/api/health` while signed in.
 */
export const dynamic = "force-dynamic";

interface Step {
  step: string;
  ms: number;
  ok: boolean;
  detail?: string;
}

export async function GET() {
  const person = await readSession().catch(() => null);
  if (!person) {
    return NextResponse.json(
      { error: "Sign in first, then open this page again." },
      { status: 401 },
    );
  }

  const steps: Step[] = [];

  /** Time one step, record it, and keep going even when it fails. */
  async function timed<T>(step: string, work: () => Promise<T>): Promise<T | null> {
    const started = Date.now();
    try {
      const value = await work();
      steps.push({ step, ms: Date.now() - started, ok: true });
      return value;
    } catch (error) {
      steps.push({
        step,
        ms: Date.now() - started,
        ok: false,
        detail: (error as Error)?.message ?? String(error),
      });
      return null;
    }
  }

  const found = findDatabaseUrl(APP_URL_VARS);

  await timed("connect and answer SELECT 1", () => db.execute(raw`SELECT 1`));

  await timed("read the server's own clock", () =>
    db.execute(raw`SELECT now()`),
  );

  await timed("look for the staff table", () =>
    db.execute(raw`SELECT to_regclass('public.staff')::text AS present`),
  );

  await timed("count the reference data (the seed probe)", () =>
    db.execute(raw`
      SELECT (SELECT count(*)::int FROM company_profile) AS company,
             (SELECT count(*)::int FROM stores) AS stores,
             (SELECT count(*)::int FROM payment_methods) AS methods
    `),
  );

  const counts = await timed("count every row the dashboard reads", () =>
    db.execute<{
      clients: number;
      orders: number;
      order_items: number;
      purchases: number;
      payments: number;
    }>(raw`
      SELECT (SELECT count(*)::int FROM clients)      AS clients,
             (SELECT count(*)::int FROM orders)       AS orders,
             (SELECT count(*)::int FROM order_items)  AS order_items,
             (SELECT count(*)::int FROM purchases)    AS purchases,
             (SELECT count(*)::int FROM payments)     AS payments
    `),
  );

  await timed("the orders query the dashboard actually runs", () =>
    db.query.orders.findMany({ with: { items: true, timeline: true } }),
  );

  /*
   * A transaction, timed on its own. It is the expensive shape over a distant
   * database — every statement inside one is a separate round trip that cannot
   * be pipelined — so knowing what a single empty one costs tells you what the
   * distance is, without guessing at it.
   */
  await timed("an empty transaction (one round trip per statement)", () =>
    db.transaction(async (tx) => {
      await tx.execute(raw`SELECT 1`);
    }),
  );

  const total = steps.reduce((sum, s) => sum + s.ms, 0);
  const slowest = [...steps].sort((a, b) => b.ms - a.ms)[0];

  return NextResponse.json(
    {
      connection: {
        variable: found?.name ?? "none found",
        target: found ? describeUrl(found.url) : null,
        alsoPresent: [...new Set([...APP_URL_VARS, ...DIRECT_URL_VARS])].filter(
          (name) => name !== found?.name && process.env[name]?.trim(),
        ),
        region: process.env.VERCEL_REGION ?? "not on Vercel",
      },
      rows: (Array.isArray(counts) ? counts[0] : null) ?? null,
      totalMs: total,
      slowestStep: slowest ? `${slowest.step} (${slowest.ms}ms)` : null,
      firstFailure: steps.find((s) => !s.ok) ?? null,
      steps,
    },
    { status: steps.some((s) => !s.ok) ? 503 : 200 },
  );
}
