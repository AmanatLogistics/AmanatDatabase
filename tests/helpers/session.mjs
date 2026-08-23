import { createHash, randomBytes, randomUUID } from "node:crypto";
import postgres from "postgres";

/**
 * A signed-in staff member, made directly in the database.
 *
 * Every admin route needs a session now, so a test that wants to look at one
 * has to have an account. Going through the login form for each case would test
 * the login form over and over; this writes the same two rows the login form
 * writes and hands back the cookie.
 *
 * The token hashing must match `src/lib/auth/session.ts` — the cookie carries
 * the token, the database stores its SHA-256.
 */

export const SESSION_COOKIE = "amanat_session";

export async function signInDirectly(
  databaseUrl,
  { name = "Test Owner", email = `owner-${randomUUID()}@example.test` } = {},
) {
  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  try {
    const staffId = randomUUID();
    await sql`
      INSERT INTO staff (id, name, email, role, password_hash, active)
      VALUES (${staffId}, ${name}, ${email}, 'owner', 'scrypt$16384$8$1$AAAA$BBBB', true)`;

    const token = randomBytes(32).toString("base64url");
    await sql`
      INSERT INTO sessions (token_hash, staff_id, expires_at)
      VALUES (${createHash("sha256").update(token).digest("hex")}, ${staffId},
              ${new Date(Date.now() + 86_400_000)})`;

    return { staffId, email, name, token };
  } finally {
    await sql.end();
  }
}

/** Empty the staff table, and every session hanging off it. */
export async function clearStaff(databaseUrl) {
  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  try {
    await sql`TRUNCATE staff CASCADE`;
  } finally {
    await sql.end();
  }
}

/**
 * One client and one order, written where the app now reads them.
 *
 * These used to be pushed into the browser's localStorage, which is where the
 * app kept its data. It keeps it in Postgres now, so seeding the browser seeds
 * nothing and the page renders an order that does not exist.
 */
export async function seedOrder(databaseUrl, { staffName = "Test Owner" } = {}) {
  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  try {
    const clientId = randomUUID();
    await sql`
      INSERT INTO clients (id, code, name, phone, city)
      VALUES (${clientId}, ${"AMN-C-" + clientId.slice(0, 4)}, 'Test Client',
              '0700000001', 'Kandahar')`;

    const orderId = randomUUID();
    const orderNo = `AS-2026-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    const trackingNumber = `AS-2026-${randomUUID().slice(0, 6).toUpperCase()}`;
    await sql`
      INSERT INTO orders (id, order_no, tracking_number, client_id, status, source)
      VALUES (${orderId}, ${orderNo}, ${trackingNumber}, ${clientId},
              'confirmed', 'walk_in')`;

    await sql`
      INSERT INTO order_items (id, order_id, position, name, store_id, category,
                              qty, unit_price_afn, unit_cost_afn)
      VALUES (${randomUUID()}, ${orderId}, 0, 'Test item', 'store-amazon-us',
              'other', 1, 1000, 800)`;

    await sql`
      INSERT INTO order_events (id, order_id, kind, title, actor)
      VALUES (${randomUUID()}, ${orderId}, 'requested', 'Order created', ${staffName})`;

    return { clientId, orderId, orderNo, trackingNumber };
  } finally {
    await sql.end();
  }
}

/** Empty the operations tables. Cascades from clients. */
export async function clearOperations(databaseUrl) {
  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  try {
    await sql`TRUNCATE clients CASCADE`;
  } finally {
    await sql.end();
  }
}
