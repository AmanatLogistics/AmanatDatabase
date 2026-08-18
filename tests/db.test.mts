import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";

import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";

import * as schema from "../src/db/schema.ts";

/**
 * What the database guarantees that a browser never could.
 *
 * These are not tests of the UI. They are tests of the promises the schema
 * makes: that two operators on two machines cannot mint the same tracking
 * number, that money is stored as whole Afghani, and that deleting an order
 * takes the money recorded against it rather than stranding it.
 *
 * Point DATABASE_URL at a throwaway database — every table is emptied before
 * each case.
 */

const url = process.env.DATABASE_URL;

/*
 * Skipped rather than failed when there is no database to talk to. `npm test`
 * has to stay runnable by somebody who has only just cloned this, and a suite
 * that goes red for a missing environment variable teaches everyone to ignore
 * red.
 */
const needsDatabase = { skip: url ? false : "DATABASE_URL is not set" };

let sql: ReturnType<typeof postgres>;
let db: ReturnType<typeof drizzle<typeof schema>>;

const CLIENT = {
  id: "client-1",
  code: "AMN-C-0001",
  name: "Test Client",
  phone: "0700000001",
  city: "Kabul",
};

function order(over: Record<string, unknown> = {}) {
  return {
    id: "order-1",
    orderNo: "AS-2026-0001",
    trackingNumber: "AM-2026-AAA111",
    clientId: CLIENT.id,
    ...over,
  };
}

before(async () => {
  if (!url) return;
  sql = postgres(url!, { max: 1, onnotice: () => {} });
  db = drizzle(sql, { schema });
});

/**
 * Assert that a write is refused, and refused for the reason given.
 *
 * `assert.rejects` alone is not enough here: Drizzle wraps the driver error and
 * its `message` is only "Failed query: insert into …". The constraint that
 * actually fired is on the cause, so a naive regex match passes for any failure
 * at all — including a typo in the test.
 */
async function refused(run: () => Promise<unknown>, reason: RegExp) {
  let error: unknown;
  try {
    await run();
  } catch (caught) {
    error = caught;
  }

  assert.ok(error, `the write was accepted; expected it to be refused (${reason})`);
  const detail = [
    (error as Error).message,
    String((error as { cause?: unknown }).cause ?? ""),
    ((error as { cause?: { constraint_name?: string } }).cause ?? {})
      .constraint_name ?? "",
  ].join(" | ");
  assert.match(detail, reason);
}

after(async () => {
  await sql?.end();
});

async function reset() {
  // Truncating clients cascades through orders and everything hanging off them.
  await sql`TRUNCATE clients, store_products, web_orders, staff, notifications,
            stores, payment_methods, company_profile RESTART IDENTITY CASCADE`;
}

describe("the database keeps the promises the browser could not", needsDatabase, () => {
  test("a tracking number cannot be issued twice", async () => {
    await reset();
    await db.insert(schema.clients).values(CLIENT);
    await db.insert(schema.orders).values(order());

    // Same tracking number, different order. This is the exact collision two
    // operators on two machines could previously both commit and never notice.
    await refused(
      () =>
        db.insert(schema.orders).values(
          order({ id: "order-2", orderNo: "AS-2026-0002" }),
        ),
      /orders_tracking_number_unique/,
    );

    const rows = await db.select().from(schema.orders);
    assert.equal(rows.length, 1, "the duplicate must not have been written");
  });

  test("an order number cannot be issued twice either", async () => {
    await reset();
    await db.insert(schema.clients).values(CLIENT);
    await db.insert(schema.orders).values(order());

    await refused(
      () =>
        db.insert(schema.orders).values(
          order({ id: "order-2", trackingNumber: "AM-2026-BBB222" }),
        ),
      /orders_order_no_unique/,
    );
  });

  test("deleting an order takes its items, events, purchases and payments", async () => {
    await reset();
    await db.insert(schema.clients).values(CLIENT);
    await db.insert(schema.orders).values(order());
    await db.insert(schema.orderItems).values({
      id: "item-1",
      orderId: "order-1",
      name: "A thing",
      storeId: "store-1",
      qty: 2,
      unitPriceAfn: 1500,
      unitCostAfn: 1200,
    });
    await db.insert(schema.orderEvents).values({
      id: "event-1",
      orderId: "order-1",
      kind: "requested",
      title: "Order created",
      actor: "Test",
    });
    await db.insert(schema.purchases).values({
      id: "purchase-1",
      purchaseNo: "PO-2026-0001",
      orderId: "order-1",
      storeId: "store-1",
      paymentMethodId: "pm-cash",
      totalCostAfn: 2400,
    });
    await db.insert(schema.purchaseItems).values({
      purchaseId: "purchase-1",
      orderItemId: "item-1",
    });
    await db.insert(schema.payments).values({
      id: "payment-1",
      receiptNo: "RCT-2026-0001",
      clientId: CLIENT.id,
      orderId: "order-1",
      amountAfn: 3000,
      methodId: "pm-cash",
    });

    await db.delete(schema.orders).where(eq(schema.orders.id, "order-1"));

    for (const [label, table] of [
      ["items", schema.orderItems],
      ["events", schema.orderEvents],
      ["purchases", schema.purchases],
      ["purchase links", schema.purchaseItems],
      ["payments", schema.payments],
    ] as const) {
      const left = await db.select().from(table);
      assert.equal(left.length, 0, `${label} were left behind`);
    }

    // The client is not a casualty of deleting one of their orders.
    const clientsLeft = await db.select().from(schema.clients);
    assert.equal(clientsLeft.length, 1);
  });

  test("deleting a client takes their orders with them", async () => {
    await reset();
    await db.insert(schema.clients).values(CLIENT);
    await db.insert(schema.orders).values(order());

    await db.delete(schema.clients).where(eq(schema.clients.id, CLIENT.id));

    assert.equal((await db.select().from(schema.orders)).length, 0);
  });

  test("every money column is an integer, so no amount can drift", async () => {
    /*
     * The guarantee is the column type, not a check on one write: Postgres will
     * quietly round a fractional value into an integer column on assignment, so
     * asserting that one UPDATE fails would prove nothing. Asserting that no
     * money column anywhere is a float is the thing that actually holds.
     */
    const columns = await sql<{ table_name: string; column_name: string; data_type: string }[]>`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name LIKE '%_afn'
      ORDER BY table_name, column_name`;

    assert.ok(columns.length >= 10, `expected the money columns, found ${columns.length}`);
    const wrong = columns.filter((c) => c.data_type !== "integer");
    assert.deepEqual(wrong, [], "these money columns are not integers");

    await reset();
    await db.insert(schema.clients).values(CLIENT);
    await db.insert(schema.orders).values(order({ serviceFeeAfn: 850 }));
    const [row] = await db.select().from(schema.orders);
    assert.equal(row.serviceFeeAfn, 850);
    assert.ok(Number.isInteger(row.serviceFeeAfn));
  });

  test("an order comes back with everything hanging off it in one query", async () => {
    await reset();
    await db.insert(schema.clients).values(CLIENT);
    await db.insert(schema.orders).values(order());
    await db.insert(schema.orderItems).values([
      {
        id: "item-1",
        orderId: "order-1",
        position: 0,
        name: "First",
        storeId: "s",
        unitPriceAfn: 100,
        unitCostAfn: 80,
      },
      {
        id: "item-2",
        orderId: "order-1",
        position: 1,
        name: "Second",
        storeId: "s",
        unitPriceAfn: 200,
        unitCostAfn: 160,
      },
    ]);

    const found = await db.query.orders.findFirst({
      where: eq(schema.orders.id, "order-1"),
      with: { client: true, items: true, timeline: true },
    });

    assert.ok(found, "the order was not found");
    assert.equal(found!.client.name, "Test Client");
    assert.equal(found!.items.length, 2);
    assert.deepEqual(
      found!.items.map((i) => i.name).sort(),
      ["First", "Second"],
    );
  });

  test("a staff email cannot be registered twice", async () => {
    await reset();
    await db.insert(schema.staff).values({
      id: "staff-1",
      name: "Owner",
      email: "owner@example.com",
      role: "owner",
    });

    await refused(
      () =>
        db.insert(schema.staff).values({
          id: "staff-2",
          name: "Somebody else",
          email: "owner@example.com",
        }),
      /staff_email_unique/,
    );
  });

  test("a status outside the pipeline is refused", async () => {
    await reset();
    await db.insert(schema.clients).values(CLIENT);

    await refused(
      () =>
        sql`INSERT INTO orders (id, order_no, tracking_number, client_id, status)
            VALUES ('order-x', 'AS-2026-9999', 'AM-2026-ZZZ999', ${CLIENT.id}, 'lost_in_post')`,
      /invalid input value for enum/,
    );
  });
});
