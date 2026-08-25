import { after, describe, test } from "node:test";
import assert from "node:assert/strict";

import postgres from "postgres";

/**
 * One connection is one queue.
 *
 * The app read a session in six seconds against a database that answered the
 * same query in three milliseconds when asked from another route. Both numbers
 * were true. The pool was `max: 1`, so every query in the process shared a
 * single connection: while anything slow held it — a transaction seeding the
 * reference data, minting a tracking number, writing a session — everything
 * else waited behind it, however unrelated.
 *
 * Worse, the deadline that was supposed to rescue that case made it permanent.
 * Giving up on a query does not remove it from the connection; the next request
 * queued behind the abandoned one, timed out in its turn, and left another. An
 * instance that failed once failed for ever, while a health check on a different
 * route reported perfect health from its own fresh instance.
 *
 * These two cases are the mechanism, measured.
 *
 * Point DATABASE_URL at a throwaway database.
 */

const url = process.env.DATABASE_URL;
const needsDatabase = { skip: url ? false : "DATABASE_URL is not set" };

const clients: ReturnType<typeof postgres>[] = [];

function pool(max: number) {
  const client = postgres(url!, { max, prepare: false, onnotice: () => {} });
  clients.push(client);
  return client;
}

after(async () => {
  await Promise.all(clients.map((c) => c.end({ timeout: 5 }).catch(() => {})));
});

describe("head-of-line blocking on a shared connection", needsDatabase, () => {
  test("with one connection, a fast query waits for a slow one", async () => {
    const sql = pool(1);

    /*
     * Subscribed to, not merely created. A postgres.js query is lazy — it is
     * not sent until something waits on it — so building one and then awaiting
     * a second sends the second first, and the test measures nothing. The
     * `catch` is what puts the slow query on the wire.
     */
    const slow = sql`SELECT pg_sleep(2)`;
    slow.catch(() => {});
    await new Promise((r) => setTimeout(r, 100));

    const started = Date.now();
    await sql`SELECT 1 AS n`;
    const waited = Date.now() - started;
    await slow.catch(() => {});

    assert.ok(
      waited > 1_500,
      `the fast query should have been stuck behind the slow one, waited ${waited}ms`,
    );
  });

  test("with three, it does not", async () => {
    const sql = pool(3);

    const slow = sql`SELECT pg_sleep(2)`;
    slow.catch(() => {});
    await new Promise((r) => setTimeout(r, 100));

    const started = Date.now();
    await sql`SELECT 1 AS n`;
    const waited = Date.now() - started;
    await slow.catch(() => {});

    assert.ok(
      waited < 700,
      `the fast query should have gone straight through, waited ${waited}ms`,
    );
  });
});

describe("a query the deadline gave up on", needsDatabase, () => {
  test("poisons the pool if the connection is reused", async () => {
    const sql = pool(1);

    // Abandoned, exactly as a deadline abandons one — nobody awaits it.
    const orphan = sql`SELECT pg_sleep(3)`;
    orphan.catch(() => {});

    const started = Date.now();
    await sql`SELECT 1 AS n`;
    const waited = Date.now() - started;
    await orphan.catch(() => {});

    assert.ok(
      waited > 2_000,
      `the next query should have queued behind the orphan, waited ${waited}ms`,
    );
  });

  test("costs nothing once the connection is discarded instead", async () => {
    const poisoned = pool(1);

    const orphan = poisoned`SELECT pg_sleep(3)`;
    orphan.catch(() => {});

    /*
     * What `resetConnection` does: drop the client without waiting on it, and
     * let the next caller open a fresh one. The handshake it costs is the
     * cheapest thing in this file.
     */
    void poisoned.end({ timeout: 0 }).catch(() => {});
    const fresh = pool(1);

    const started = Date.now();
    await fresh`SELECT 1 AS n`;
    const waited = Date.now() - started;

    assert.ok(
      waited < 700,
      `a fresh connection should not know about the orphan, waited ${waited}ms`,
    );
  });
});
