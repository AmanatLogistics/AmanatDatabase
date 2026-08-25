import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";

import postgres from "postgres";

import { buildLedgerIndex, orderEconomics } from "../src/lib/finance.ts";
import type { Order, Payment, Purchase } from "../src/lib/types.ts";

/**
 * Money entered has to be money shown.
 *
 * A client, an order and a purchase were logged, and the dashboard reported
 * nothing earned. Nothing was broken in the arithmetic: orders start their life
 * at a status, `BILLABLE_ORDER_STATUSES` deliberately excludes the two that
 * mean "somebody is only asking", and the create form — which demands a client,
 * the products, what we pay and what we charge — was filing its orders under
 * one of them. So the figures were correct and empty at the same time.
 *
 * These cases hold the two halves apart: an enquiry still earns nothing, and an
 * order somebody actually entered does.
 */

const url = process.env.DATABASE_URL;
const needsDatabase = { skip: url ? false : "DATABASE_URL is not set" };

let sql: ReturnType<typeof postgres>;

before(() => {
  if (url) sql = postgres(url, { max: 2, prepare: false, onnotice: () => {} });
});

after(async () => {
  await sql?.end({ timeout: 5 });
});

function orderWith(status: Order["status"]): Order {
  return {
    id: "o1",
    orderNo: "AS-2026-0001",
    trackingNumber: "AM-2026-AAA111",
    clientId: "c1",
    status,
    source: "whatsapp",
    requestedAt: "2026-08-01T00:00:00.000Z",
    items: [
      {
        id: "i1",
        name: "Samsung Galaxy A54",
        storeId: "store-amazon-us",
        category: "mobile",
        qty: 1,
        unitPriceAfn: 31_500,
        unitCostAfn: 26_000,
      },
    ],
    timeline: [],
    serviceFeeAfn: 2_500,
    shippingChargedAfn: 0,
    freightCostAfn: 0,
    customsDutyAfn: 0,
    discountAfn: 0,
  } as Order;
}

const purchases: Purchase[] = [];
const payments: Payment[] = [];

/** The order-keyed lookups every derivation on a screen shares. */
function economicsFor(order: Order) {
  return orderEconomics(order, buildLedgerIndex([order], purchases, payments));
}

describe("what the dashboard counts", () => {
  test("an order a member of staff entered earns money", () => {
    const economics = economicsFor(orderWith("confirmed"));

    assert.equal(economics.revenue.totalAfn, 34_000, "31,500 charged plus a 2,500 fee");
    assert.equal(economics.profitAfn, 8_000, "34,000 in, 26,000 out");
    assert.ok(economics.marginPercent > 23);
  });

  test("an enquiry still earns nothing", () => {
    for (const status of ["requested", "quoted"] as const) {
      const economics = economicsFor(orderWith(status));
      assert.equal(
        economics.balanceAfn,
        0,
        `${status} should not be billable — nobody has agreed to anything`,
      );
    }
  });

  test("and a cancelled order earns nothing either", () => {
    const economics = economicsFor(orderWith("cancelled"));
    assert.equal(economics.balanceAfn, 0);
  });
});

describe("the status an order is actually created with", needsDatabase, () => {
  test("is one the dashboard counts", async () => {
    /*
     * Read out of the source rather than asserted against a copy of it. The bug
     * was precisely that this literal and the billable list disagreed, and two
     * lists in two files drift apart again the moment nobody is looking.
     */
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("../src/lib/server/operations.ts", import.meta.url), "utf8"),
    );
    const match = source.match(/status: "(\w+)",\s*\n\s*source: input\.source/);
    assert.ok(match, "could not find the status createOrder inserts");

    const { BILLABLE_ORDER_STATUSES } = await import("../src/lib/constants.ts");
    assert.ok(
      BILLABLE_ORDER_STATUSES.includes(match![1] as Order["status"]),
      `createOrder files new orders as "${match![1]}", which the dashboard does not count`,
    );
  });
});
