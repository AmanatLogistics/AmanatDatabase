import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";
import { APP_URL_VARS, findDatabaseUrl, missingUrlMessage } from "@/db/url";

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
  const client = postgres(found.url, { max: 1, prepare: false });
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

export { schema };
