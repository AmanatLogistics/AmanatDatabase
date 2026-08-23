import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/**
 * Creating the schema, when several instances try at once.
 *
 * The bug these guard against was not a missing table — it was a lock. The old
 * code took `pg_advisory_lock` around the migration and released it afterwards.
 * That works on a direct connection and fails silently on a transaction pooler,
 * which is what Supabase hands you and what this app is configured to use: the
 * lock is taken on one backend and the unlock asked of another, which does not
 * own it and refuses. The lock then sits on a pooled session that nobody can
 * reach, and everything that later asks for it waits for ever — a build that
 * hangs, a request that dies when the platform's clock runs out, and no error
 * anywhere to say why.
 *
 * So the cases worth writing are about contention, not about SQL.
 *
 * Point DATABASE_URL at a throwaway database.
 */

const url = process.env.DATABASE_URL;
const needsDatabase = { skip: url ? false : "DATABASE_URL is not set" };

let sql: ReturnType<typeof postgres>;

before(() => {
  if (url) sql = postgres(url, { max: 5, prepare: false, onnotice: () => {} });
});

after(async () => {
  await sql?.end({ timeout: 5 });
});

describe("session advisory locks over a pooler", needsDatabase, () => {
  test("a lock released from another backend stays held", async () => {
    const a = postgres(url!, { max: 1, prepare: false, onnotice: () => {} });
    const b = postgres(url!, { max: 1, prepare: false, onnotice: () => {} });
    const key = 4242424;

    try {
      await a`SELECT pg_advisory_lock(${key})`;

      /*
       * This is precisely what a transaction pooler does to two statements that
       * are not wrapped in one explicit transaction: it is free to route them
       * to different server sessions.
       */
      const [{ pg_advisory_unlock: released }] =
        await b<{ pg_advisory_unlock: boolean }[]>`SELECT pg_advisory_unlock(${key})`;
      assert.equal(released, false, "the unlock should be refused");

      const [{ n }] = await b<{ n: number }[]>`
        SELECT count(*)::int AS n FROM pg_locks
        WHERE locktype = 'advisory' AND objid = ${key} AND granted`;
      assert.equal(n, 1, "and the lock should still be held");
    } finally {
      await a.end({ timeout: 5 });
      await b.end({ timeout: 5 });
    }
  });

  test("nothing in the app takes one any more", () => {
    /*
     * The guard that keeps this from coming back. `pg_advisory_xact_lock` is
     * fine — it is released by the transaction that took it, so a pooler cannot
     * strand it — but the session-scoped `pg_advisory_lock` must not reappear.
     */
    const offenders: string[] = [];
    for (const file of ["src/db/ensure-schema.ts", "scripts/migrate.mts"]) {
      const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
      // Stripped of comments first: the files explain the hazard in prose.
      const code = source
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "")
        .replace(/^\s*\*.*$/gm, "");
      if (/pg_advisory_lock\b/.test(code)) offenders.push(file);
    }
    assert.deepEqual(offenders, []);
  });
});

describe("migrating an empty database", needsDatabase, () => {
  const scratch = "amanat_race_test";

  async function freshDatabase(): Promise<string> {
    await sql.unsafe(`DROP DATABASE IF EXISTS ${scratch} WITH (FORCE)`);
    await sql.unsafe(`CREATE DATABASE ${scratch}`);
    const target = new URL(url!);
    target.pathname = `/${scratch}`;
    return target.toString();
  }

  test("four instances waking together all succeed, and none hangs", async () => {
    const target = await freshDatabase();

    /*
     * Four separate connections, migrating at the same moment — a cold start
     * where several functions wake on the same request burst. One will win each
     * collision and the rest must recover rather than throw, and the whole
     * thing must finish rather than block.
     */
    const racers = Array.from({ length: 4 }, () =>
      migrateWithRetries(target),
    );

    const settled = await within(
      30_000,
      Promise.allSettled(racers),
      "timed out — something is blocking",
    );

    const failures = settled.filter((r) => r.status === "rejected");
    assert.deepEqual(
      failures.map((f) => String((f as PromiseRejectedResult).reason)),
      [],
      "every racer should end up with a usable schema",
    );

    const check = postgres(target, { max: 1, prepare: false, onnotice: () => {} });
    try {
      const tables = await check<{ n: number }[]>`
        SELECT count(*)::int AS n FROM information_schema.tables
        WHERE table_schema = 'public'`;
      assert.equal(tables[0].n, 17, "all 17 tables should exist exactly once");

      const applied = await check<{ n: number }[]>`
        SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`;
      assert.ok(applied[0].n > 0, "the migration should be recorded as applied");
    } finally {
      await check.end({ timeout: 5 });
    }

    await sql.unsafe(`DROP DATABASE IF EXISTS ${scratch} WITH (FORCE)`);
  });

  test("a leftover advisory lock does not block it", async () => {
    const target = await freshDatabase();

    // Strand a lock on the old key, exactly as a pre-fix deploy would have.
    const squatter = postgres(target, { max: 1, prepare: false, onnotice: () => {} });
    await squatter`SELECT pg_advisory_lock(hashtext('amanat:migrate'))`;

    try {
      await within(
        20_000,
        migrateWithRetries(target),
        "blocked on the stale lock",
      );

      const check = postgres(target, { max: 1, prepare: false, onnotice: () => {} });
      try {
        const tables = await check<{ n: number }[]>`
          SELECT count(*)::int AS n FROM information_schema.tables
          WHERE table_schema = 'public'`;
        assert.equal(tables[0].n, 17);
      } finally {
        await check.end({ timeout: 5 });
      }
    } finally {
      await squatter.end({ timeout: 5 });
      await sql.unsafe(`DROP DATABASE IF EXISTS ${scratch} WITH (FORCE)`);
    }
  });
});

/**
 * Fail if `work` has not finished in time — and, either way, stop waiting.
 *
 * A bare `setTimeout` inside `Promise.race` keeps Node's event loop alive until
 * it fires, so a suite that passes in half a second still sits there for the
 * length of its own timeout before exiting. That reads as a hang, which is
 * exactly the failure these cases are about.
 */
async function within<T>(ms: number, work: Promise<T>, message: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const limit = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  try {
    return await Promise.race([work, limit]);
  } finally {
    clearTimeout(timer!);
  }
}

/**
 * The same shape `ensureSchema` uses, against an arbitrary database.
 *
 * `ensureSchema` itself reads the connection from the environment at import
 * time and caches it for the life of the process, which is right for a server
 * and useless for a test that needs four of them at once. This mirrors its
 * logic rather than its plumbing.
 */
async function migrateWithRetries(target: string): Promise<void> {
  const client = postgres(target, { max: 1, prepare: false, onnotice: () => {} });
  try {
    for (let attempt = 1; ; attempt++) {
      try {
        await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
        return;
      } catch (error) {
        const [{ present }] = await client<{ present: string | null }[]>`
          SELECT to_regclass('public.staff')::text AS present`;
        if (present) return;
        if (attempt >= 5) throw error;
        await new Promise((resolve) => setTimeout(resolve, attempt * 250));
      }
    }
  } finally {
    await client.end({ timeout: 5 });
  }
}
