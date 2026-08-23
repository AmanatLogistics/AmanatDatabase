import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import postgres from "postgres";

/**
 * The shop's server side, exercised against a real database.
 *
 * These functions are `use server`, which means each is a POST endpoint anybody
 * can call with anything. The cases that matter are therefore not "does the
 * happy path work" but "what happens when the caller lies" — a price of their
 * choosing, a quantity of minus one, an id that is not for sale.
 *
 * Imported through a Next-free path: the actions only use the database client
 * and, where they check a session, they are not covered here — that is what
 * `tests/auth.test.mts` is for.
 */

const url = process.env.DATABASE_URL;
const needsDatabase = { skip: url ? false : "DATABASE_URL is not set" };

let sql: ReturnType<typeof postgres>;
let shop: typeof import("../src/lib/server/shop.ts");
let closeDb: () => Promise<void>;

before(async () => {
  if (!url) return;
  sql = postgres(url, { max: 1, onnotice: () => {} });
  shop = await import("../src/lib/server/shop.ts");
  ({ closeDb } = await import("../src/db/index.ts"));
});

after(async () => {
  await sql?.end();
  // The app's own connection too, or Node never exits and this reads as a
  // timeout rather than a pass.
  await closeDb?.();
});

async function reset() {
  await sql`TRUNCATE store_products, web_orders, notifications RESTART IDENTITY CASCADE`;
}

async function product(over: Record<string, unknown> = {}) {
  const id = randomUUID();
  const values = {
    slug: `p-${id.slice(0, 8)}`,
    name: "A product",
    price: 1000,
    cost: 800,
    active: true,
    ...over,
  };
  await sql`
    INSERT INTO store_products (id, slug, name, description, category,
                                price_afn, cost_afn, store_id, active)
    VALUES (${id}, ${values.slug as string}, ${values.name as string}, '', 'other',
            ${values.price as number}, ${values.cost as number}, 'store-1',
            ${values.active as boolean})`;
  return id;
}

describe("the shop's public server actions", needsDatabase, () => {
  test("a customer never receives a cost price", async () => {
    await reset();
    await product({ name: "Visible", price: 5000, cost: 3200 });

    const listed = await shop.listPublishedProducts();
    assert.equal(listed.length, 1);
    assert.equal(listed[0].priceAfn, 5000);
    /*
     * Not "is it rendered" — is it *there*. A component that does not display
     * a field still ships it in the page source for anyone who looks.
     */
    assert.ok(
      !("costAfn" in listed[0]),
      `cost price reached the customer: ${JSON.stringify(listed[0])}`,
    );
    assert.ok(!JSON.stringify(listed[0]).includes("3200"));
  });

  test("unpublished products are not for sale", async () => {
    await reset();
    const hidden = await product({ name: "Draft", active: false, slug: "draft" });

    assert.deepEqual(await shop.listPublishedProducts(), []);
    assert.equal(await shop.getPublishedProduct("draft"), null);

    // And cannot be bought by knowing the id.
    const result = await shop.placeOrder({
      name: "Somebody", phone: "0700000001", city: "Kandahar",
      lines: [{ productId: hidden, qty: 1 }],
    });
    assert.ok(result.error, "an unpublished product was sold");
  });

  test("the price comes from the database, not the basket", async () => {
    await reset();
    const id = await product({ price: 9000 });

    // A caller sending their own price is describing a product we do not sell.
    await shop.placeOrder({
      name: "Buyer", phone: "0700000002", city: "Kandahar",
      lines: [{ productId: id, qty: 2, priceAfn: 1 } as never],
    });

    const [row] = await sql`SELECT total_afn FROM web_orders`;
    assert.equal(row.total_afn, 18_000, "the caller's price was believed");
  });

  test("a quantity has to be a real quantity", async () => {
    await reset();
    const id = await product({ price: 1000 });

    for (const qty of [0, -5, 1.5, Number.NaN, 1e9]) {
      await reset();
      await sql`INSERT INTO store_products (id, slug, name, description, category,
                price_afn, cost_afn, store_id, active)
                VALUES (${id}, 'p', 'A product', '', 'other', 1000, 800, 's', true)`;
      const result = await shop.placeOrder({
        name: "Buyer", phone: "0700000003", city: "Kandahar",
        lines: [{ productId: id, qty }],
      });

      const rows = await sql`SELECT total_afn FROM web_orders`;
      if (rows.length > 0) {
        assert.ok(
          rows[0].total_afn > 0 && rows[0].total_afn <= 50_000,
          `qty ${qty} produced a total of ${rows[0].total_afn}`,
        );
      } else {
        assert.ok(result.error, `qty ${qty} was silently accepted`);
      }
    }
  });

  test("the same product twice is one line, not two", async () => {
    await reset();
    const id = await product({ price: 1000 });

    await shop.placeOrder({
      name: "Buyer", phone: "0700000004", city: "Kandahar",
      lines: [{ productId: id, qty: 2 }, { productId: id, qty: 3 }],
    });

    const lines = await sql`SELECT qty FROM web_order_lines`;
    assert.equal(lines.length, 1);
    assert.equal(lines[0].qty, 5);
  });

  test("an order and its notification are written together", async () => {
    await reset();
    const id = await product({ price: 2500 });

    const { reference } = await shop.placeOrder({
      name: "Zarmina", phone: "0700000005", city: "Kandahar",
      lines: [{ productId: id, qty: 1 }],
    });

    assert.match(reference ?? "", /^WEB-\d{4}-\d{4}$/);
    const [note] = await sql`SELECT * FROM notifications`;
    assert.ok(note, "no notification was written for a new order");
    assert.equal(note.kind, "web_order");
    assert.ok(note.title.includes(reference!));
    assert.equal(note.read, false);
  });

  test("nonsense in the customer's details is refused", async () => {
    await reset();
    const id = await product();

    for (const [label, input] of [
      ["no name", { name: "", phone: "0700000000" }],
      ["no phone", { name: "Somebody", phone: "" }],
      ["a phone that is not one", { name: "Somebody", phone: "abc" }],
    ] as const) {
      const result = await shop.placeOrder({
        city: "Kandahar", lines: [{ productId: id, qty: 1 }], ...input,
      });
      assert.ok(result.error, `${label} was accepted`);
    }
    assert.equal((await sql`SELECT * FROM web_orders`).length, 0);
  });

  test("an empty basket is not an order", async () => {
    await reset();
    const result = await shop.placeOrder({
      name: "Somebody", phone: "0700000006", city: "Kandahar", lines: [],
    });
    assert.ok(result.error);
  });

  test("tracking finds an order by its reference and leaks nothing", async () => {
    await reset();
    const id = await product({ name: "Kettle", price: 2000 });
    const { reference } = await shop.placeOrder({
      name: "Zarmina", phone: "0700123456", city: "Kandahar",
      address: "House 4, Street 2", lines: [{ productId: id, qty: 1 }],
    });

    const found = await shop.findWebOrder(reference!);
    assert.ok(found);
    assert.equal(found!.reference, reference);
    assert.equal(found!.lines[0].name, "Kettle");

    // The person holding the reference already knows their own name. They
    // must not be handed the phone number or address of whoever placed it.
    const serialised = JSON.stringify(found);
    assert.ok(!serialised.includes("0700123456"), "phone number leaked");
    assert.ok(!serialised.includes("House 4"), "address leaked");
  });

  test("a reference that does not exist finds nothing, quietly", async () => {
    await reset();
    assert.equal(await shop.findWebOrder("WEB-2026-9999"), null);
    assert.equal(await shop.findWebOrder("nonsense"), null);
    assert.equal(await shop.findWebOrder(""), null);
    // Case and padding are the customer reading it off a phone screen.
    const id = await product();
    const { reference } = await shop.placeOrder({
      name: "Buyer", phone: "0700000007", city: "Kandahar",
      lines: [{ productId: id, qty: 1 }],
    });
    assert.ok(await shop.findWebOrder(`  ${reference!.toLowerCase()}  `));
  });
});
