import "server-only";

/**
 * Give a database call a deadline it cannot talk its way out of.
 *
 * The driver's `connect_timeout` only covers opening the socket — read
 * `connectTimer.cancel()` in postgres.js and you will see it stops the moment
 * the connection is established. After that, a query that never answers is
 * bounded by nothing at all. That is not a hypothetical: a paused database
 * accepts the connection and then simply never replies, and a serverless
 * function sits there until the platform kills it. What the owner sees is
 * `504: FUNCTION_INVOCATION_TIMEOUT` — a page that loads forever and then dies,
 * with nothing in the logs, because the process was killed rather than allowed
 * to report anything.
 *
 * A server-side `statement_timeout` would be the tidier answer, but it is a
 * session setting, and session settings do not survive a transaction pooler —
 * the same trap that made advisory locks unusable here. So the deadline lives
 * in our own code, where it works regardless of what sits in front of the
 * database.
 *
 * This does not cancel the query; Postgres carries on with it. It gives the
 * request its turn back, so an error page can be rendered while there is still
 * time to render one. An error that says what is wrong beats a timeout that
 * says nothing.
 */
export class DatabaseUnreachableError extends Error {
  constructor(what: string, ms: number) {
    super(
      [
        `The database did not answer within ${(ms / 1000).toFixed(1)}s (${what}).`,
        "",
        "It accepted the connection and then went quiet, which usually means",
        "one of:",
        "",
        "  • the database is paused — a free Supabase project pauses after a",
        "    week idle and has to be resumed by hand in its dashboard",
        "  • the connection string points at a database that is no longer",
        "    there, most often after a second one was connected alongside it",
        "  • a query is blocked behind a lock left by an earlier request that",
        "    was killed part-way through",
        "",
        "`npm run db:check` answers which, and names every connection string",
        "this environment has.",
      ].join("\n"),
    );
    this.name = "DatabaseUnreachableError";
  }
}

/**
 * The budget for anything on the request path.
 *
 * A Vercel Hobby function gets ten seconds in total. Six leaves room to build
 * and send a real page with the remaining four, which is the whole point —
 * finishing second is still finishing.
 */
export const REQUEST_DEADLINE_MS = 6_000;

export async function withDeadline<T>(
  work: Promise<T>,
  what: string,
  ms: number = REQUEST_DEADLINE_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;

  const expiry = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new DatabaseUnreachableError(what, ms)), ms);
  });

  try {
    return await Promise.race([work, expiry]);
  } finally {
    /*
     * Cleared whichever way this went. An uncleared timer keeps Node's event
     * loop alive, which on a serverless function means paying for the wait
     * after the answer has already been sent.
     */
    clearTimeout(timer!);
    /*
     * The losing promise still settles later. Unhandled, a rejection from it
     * would take the process down well after this request finished, and the
     * crash would be attributed to whatever unlucky request came next.
     */
    void work.catch(() => {});
  }
}
