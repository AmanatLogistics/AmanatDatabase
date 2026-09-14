import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";

import { chromium, type Browser } from "playwright";
import postgres from "postgres";

import { signInDirectly, clearStaff } from "./helpers/session.mjs";

/**
 * The printed documents.
 *
 * These had no coverage at all, and were completely broken because of it: an
 * invoice is a client component that looks its order up in the store and calls
 * `notFound()` when it is not there, and the print route group was the one
 * group that never filled that store. Every print URL answered 404 — and a
 * print URL is only ever opened directly, in a new tab, which is exactly the
 * case nothing else covered.
 *
 * Point DATABASE_URL at a throwaway database.
 */

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATABASE_URL = process.env.DATABASE_URL;
const needsDatabase = { skip: DATABASE_URL ? false : "DATABASE_URL is not set" };

let server: ReturnType<typeof spawn> | undefined;
let browser: Browser | undefined;
let baseUrl: string;
let sql: ReturnType<typeof postgres>;
let orderId = "";
let paymentId = "";

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.listen(0, () => {
      const { port } = probe.address() as { port: number };
      probe.close(() => resolve(port));
    });
    probe.on("error", reject);
  });
}

/** One order, its client, and a payment against it — the three a document needs. */
async function seedPaperwork(): Promise<void> {
  /*
   * The reference data is created by the app the first time a screen reads
   * settings, and nothing has read settings yet — so this makes the two rows a
   * document needs rather than depending on that having happened.
   */
  await sql`
    INSERT INTO stores (id, name) VALUES ('print-store', 'Amazon US')
    ON CONFLICT (id) DO NOTHING`;
  await sql`
    INSERT INTO payment_methods (id, name, kind)
    VALUES ('print-method', 'Cash', 'cash')
    ON CONFLICT (id) DO NOTHING`;
  const method = { id: "print-method" };
  const store = { id: "print-store" };

  await sql`DELETE FROM clients`;
  await sql`
    INSERT INTO clients (id, code, name, phone, city)
    VALUES ('print-c1', 'AMN-C-9001', 'Ahmad Zia', '0700111222', 'Kandahar')`;
  await sql`
    INSERT INTO orders (id, order_no, tracking_number, client_id, status, service_fee_afn)
    VALUES ('print-o1', 'AS-2026-9001', 'AS-2026-PRNT01', 'print-c1', 'confirmed', 2500)`;
  await sql`
    INSERT INTO order_items (id, order_id, name, store_id, category, qty, unit_price_afn, unit_cost_afn)
    VALUES ('print-i1', 'print-o1', 'Samsung Galaxy A54', ${store.id}, 'mobile', 1, 31500, 26000)`;
  await sql`
    INSERT INTO payments (id, receipt_no, client_id, order_id, amount_afn, method_id, type, recorded_by)
    VALUES ('print-p1', 'RC-2026-9001', 'print-c1', 'print-o1', 10000, ${method.id}, 'partial', 'tests')`;

  orderId = "print-o1";
  paymentId = "print-p1";
}

before(async () => {
  if (!DATABASE_URL) return;

  if (!existsSync(path.join(ROOT, ".next", "BUILD_ID"))) {
    await new Promise<void>((resolve, reject) => {
      const child = spawn("npx", ["next", "build"], { cwd: ROOT, stdio: "inherit" });
      child.on("error", reject);
      child.on("exit", (code) =>
        code === 0 ? resolve() : reject(new Error(`build exited ${code}`)),
      );
    });
  }

  sql = postgres(DATABASE_URL, { max: 2, prepare: false, onnotice: () => {} });

  const port = await freePort();
  baseUrl = `http://localhost:${port}`;
  server = spawn("npx", ["next", "start", "--port", String(port)], {
    cwd: ROOT,
    env: { ...process.env, DATABASE_URL },
    stdio: "ignore",
  });

  for (let i = 0; i < 60; i++) {
    try {
      await fetch(`${baseUrl}/track`);
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  await seedPaperwork();
  browser = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  });
});

after(async () => {
  await browser?.close();
  server?.kill();
  await sql?.end({ timeout: 5 });
});

/** Open `route` in a brand new tab, the way the print button does. */
async function printed(route: string): Promise<{ status: number; text: string }> {
  await clearStaff(DATABASE_URL!);
  const { token } = await signInDirectly(DATABASE_URL!);

  const context = await browser!.newContext();
  await context.addCookies([
    { name: "amanat_session", value: token, url: baseUrl },
  ]);
  const page = await context.newPage();
  const response = await page.goto(`${baseUrl}${route}`, {
    waitUntil: "networkidle",
  });
  const text = await page.locator("body").innerText();
  await context.close();
  return { status: response?.status() ?? 0, text };
}

describe("the printed documents", needsDatabase, () => {
  test("an invoice opens on its own, with the order on it", async () => {
    const { status, text } = await printed(`/print/invoice/${orderId}`);

    assert.equal(status, 200, "a print URL opened directly must not 404");
    assert.match(text, /Samsung Galaxy A54/, "the item should be listed");
    assert.match(text, /Ahmad Zia/, "the client should be named");
    assert.match(text, /AFN/, "amounts should be in Afghani");
  });

  test("a quotation does too", async () => {
    const { status, text } = await printed(`/print/quotation/${orderId}`);
    assert.equal(status, 200);
    assert.match(text, /Samsung Galaxy A54/);
  });

  test("and a receipt", async () => {
    const { status, text } = await printed(`/print/receipt/${paymentId}`);
    assert.equal(status, 200);
    assert.match(text, /Ahmad Zia/);
  });

  test("no document ever shows a dollar sign", async () => {
    /*
     * The one rule this project has about money. A printed sheet is the copy a
     * client keeps, so it is the worst place to get a currency wrong.
     */
    for (const route of [
      `/print/invoice/${orderId}`,
      `/print/quotation/${orderId}`,
      `/print/receipt/${paymentId}`,
    ]) {
      const { text } = await printed(route);
      assert.doesNotMatch(text, /\$/, `${route} printed a dollar sign`);
    }
  });
});
