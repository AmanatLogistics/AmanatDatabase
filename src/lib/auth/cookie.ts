/**
 * The session cookie's name, and nothing else.
 *
 * Split out from `session.ts` so `proxy.ts` can import it: that file must not
 * pull in the database client, and `session.ts` does.
 */
export const SESSION_COOKIE = "amanat_session";
