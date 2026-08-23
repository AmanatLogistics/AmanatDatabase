import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";
import {
  APP_URL_VARS,
  findDatabaseUrl,
  isDirectSupabaseHost,
  missingUrlMessage,
  onVercel,
} from "@/db/url";

/**
 * The database connection.
 *
 * `server-only` at the top is the guard that matters: importing this from a
 * client component is a build error rather than a connection string shipped to
 * a browser.
 *
 * One client per process, cached across hot reloads in development — Next
 * re-evaluates modules on every change, and without this each edit would open
 * another pool until Postgres refused new connections.
 */

declare global {
  var __amanatDb: Database | undefined;
}

type Database = ReturnType<typeof connect>;

function connect() {
  const found = findDatabaseUrl(APP_URL_VARS);
  if (!found) throw new Error(missingUrlMessage(APP_URL_VARS));

  /*
   * `max: 1` is not a typo. On Vercel every request can land in its own short
   * lived instance, and a pool of ten per instance exhausts Postgres long
   * before the traffic justifies it. Supabase's transaction pooler does the
   * real pooling; this side only needs one connection each.
   *
   * `prepare: false` is required by that pooler — prepared statements are bound
   * to a backend connection it is free to swap underneath us.
   */
  /*
   * Said once, at startup, where somebody reading the runtime logs will find
   * it. The alternative is what this replaces: every request failing with
   * "getaddrinfo ENOTFOUND db.xxxx.supabase.co", which sends you hunting for a
   * typo in a hostname that is spelled correctly.
   */
  if (onVercel() && isDirectSupabaseHost(found.url)) {
    console.error(
      [
        "",
        "  ╭──────────────────────────────────────────────────────────╮",
        `  │ ${found.name} is Supabase's DIRECT connection, which is       `,
        "  │ IPv6-only. Vercel's functions are IPv4-only, so every query  ",
        "  │ here will fail with ENOTFOUND.                               ",
        "  │                                                              ",
        "  │ Use the transaction pooler string instead:                   ",
        "  │   postgres.<ref>:<password>@aws-0-<region>.pooler            ",
        "  │       .supabase.com:6543/postgres                            ",
        "  ╰──────────────────────────────────────────────────────────╯",
        "",
      ].join("\n"),
    );
  }

  /*
   * Assigned to the module-level binding rather than a local, so `closeDb`
   * below has something to close. Both halves of this are wanted: the warning
   * came from the IPv6 fix, the assignment from making tests able to exit.
   */
  client = postgres(found.url, { max: 1, prepare: false });
  return drizzle(client, { schema });
}

/**
 * Connected on first use, not on import.
 *
 * This module is imported (transitively) by pages Next evaluates at build time,
 * where DATABASE_URL is deliberately absent — a build must not need production
 * credentials. Connecting eagerly turned that into "Failed to collect page data
 * for /setup". The proxy defers it to the first query, which only ever happens
 * while a request is being served.
 */
let instance: Database | undefined;
let client: ReturnType<typeof postgres> | undefined;

function resolve(): Database {
  instance ??= globalThis.__amanatDb ?? connect();
  if (process.env.NODE_ENV !== "production") globalThis.__amanatDb = instance;
  return instance;
}

export const db = new Proxy({} as Database, {
  get(_target, property, receiver) {
    return Reflect.get(resolve(), property, receiver);
  },
  has(_target, property) {
    return Reflect.has(resolve(), property);
  },
});

/**
 * Close the connection.
 *
 * Nothing in the app calls this — a serverless instance is torn down, not shut
 * down politely. It exists for tests, which otherwise hang forever after the
 * last assertion because an open socket keeps Node's event loop alive, and the
 * failure reads as "the test timed out" rather than "the test finished".
 */
export async function closeDb(): Promise<void> {
  await client?.end({ timeout: 5 });
  client = undefined;
  instance = undefined;
  globalThis.__amanatDb = undefined;
}

export { schema };
