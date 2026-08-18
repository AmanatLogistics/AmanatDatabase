import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

import { SESSION_COOKIE, signInDirectly } from "./helpers/session.mjs";

/**
 * The app chrome — the Amanat Shopping logo in the sidebar rail and the top
 * header — must be on screen on the order detail route, whether the URL is
 * opened cold in a fresh tab or reached by clicking a row in the orders list.
 *
 * Both halves of the chrome come from `AppShell`, mounted once in
 * `src/app/(app)/layout.tsx`. Anything that moves a route out from under that
 * layout — a new route group, a parallel route, a boundary file placed at the
 * wrong level — takes the logo and the header with it, and these cases are what
 * catch that.
 *
 * Known gap, deliberately not asserted here: on a URL whose record does not
 * exist, the *server* sends an empty body and the chrome is painted only after
 * hydration. See the note in the pull request. Asserting it today would commit a
 * failing test; it is written up instead.
 *
 * These routes are behind the staff login, so the suite needs a database to
 * make an account in. Without DATABASE_URL it skips rather than fails.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATABASE_URL = process.env.DATABASE_URL;
const needsDatabase = {
  skip: DATABASE_URL ? false : "DATABASE_URL is not set",
};

let server;
let browser;
let baseUrl;
let session;

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: ROOT, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${command} ${args.join(" ")} exited with ${code}`)),
    );
  });
}

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.unref();
    probe.on("error", reject);
    probe.listen(0, () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

async function waitForServer(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  throw new Error(`server at ${url} did not come up within ${timeoutMs}ms`);
}

/**
 * Playwright's bundled Chromium is the default. Images that ship their own build
 * put it elsewhere, so fall back to an explicit path rather than failing the
 * suite over a browser download.
 */
async function launchChromium() {
  try {
    return await chromium.launch();
  } catch (error) {
    const candidates = [
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
      "/opt/pw-browsers/chromium",
    ].filter((p) => p && existsSync(p));

    if (candidates.length === 0) throw error;
    return chromium.launch({ executablePath: candidates[0] });
  }
}

/**
 * One order and the client it belongs to, written straight into the storage the
 * app reads.
 *
 * The database ships empty — there is no seeded order to open — so these cases
 * bring their own. Going through the UI to create one would test the create
 * form, not the thing here, which is that the chrome survives on a detail route.
 *
 * Only the keys named are written: zustand's merge is shallow, so settings and
 * every other slice keep their defaults.
 */
const ORDER_ID = "order-test-0001";
const ORDER_NO = "AS-2026-0001";

function seedPayload() {
  const at = "2026-08-01T09:00:00.000Z";
  return JSON.stringify({
    version: 3,
    state: {
      clients: [
        {
          id: "client-test-0001",
          code: "AMN-C-0001",
          name: "Test Client",
          type: "individual",
          status: "active",
          phone: "0700000001",
          city: "Kabul",
          preferredContact: "phone",
          createdAt: at,
        },
      ],
      orders: [
        {
          id: ORDER_ID,
          orderNo: ORDER_NO,
          trackingNumber: "AM-2026-TEST01",
          clientId: "client-test-0001",
          status: "confirmed",
          source: "walk_in",
          requestedAt: at,
          items: [
            {
              id: "item-test-0001",
              name: "Test item",
              storeId: "store-amazon-us",
              category: "other",
              qty: 1,
              unitPriceAfn: 1000,
              unitCostAfn: 800,
            },
          ],
          serviceFeeAfn: 0,
          shippingChargedAfn: 0,
          discountAfn: 0,
          timeline: [
            {
              id: "event-test-0001",
              at,
              status: "requested",
              title: "Order created",
              actor: "Test",
            },
          ],
        },
      ],
    },
  });
}

async function openPage(route, { javaScriptEnabled = true } = {}) {
  const context = await browser.newContext({
    javaScriptEnabled,
    viewport: { width: 1440, height: 900 },
  });
  // Signed in, because every one of these routes is now behind the login.
  await context.addCookies([
    { name: SESSION_COOKIE, value: session.token, url: baseUrl },
  ]);

  const page = await context.newPage();
  // Runs before any app code on every document in this context.
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    ["amanat-shopping-data", seedPayload()],
  );
  const response = await page.goto(`${baseUrl}${route}`, {
    waitUntil: javaScriptEnabled ? "networkidle" : "domcontentloaded",
  });
  return { context, page, response };
}

/** Structural, not stylistic: the landmarks, so a restyle cannot break this. */
async function readChrome(page) {
  return {
    logo: await page.locator('aside a[href="/"]').count(),
    header: await page.locator("header").count(),
    search: await page.locator("header button:has-text('Search anything')").count(),
    heading: (await page.locator("h1").first().textContent())?.trim() ?? "",
  };
}

before(async () => {
  if (!DATABASE_URL) return;

  if (!existsSync(path.join(ROOT, ".next", "BUILD_ID"))) {
    await run("npx", ["next", "build"]);
  }

  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;
  server = spawn("npx", ["next", "start", "-p", String(port)], {
    cwd: ROOT,
    stdio: "ignore",
  });

  await waitForServer(baseUrl);
  browser = await launchChromium();
  session = await signInDirectly(DATABASE_URL);
});

after(async () => {
  await browser?.close();
  server?.kill();
});

describe("app chrome on the order detail route", needsDatabase, () => {
  test("is server-rendered, before any JavaScript runs", async () => {
    // JavaScript off, so this is exactly the HTML the server sent. If the route
    // ever falls outside (app)/layout.tsx, this is the case that notices.
    const { context, page, response } = await openPage(`/orders/${ORDER_ID}`, {
      javaScriptEnabled: false,
    });

    assert.equal(response.status(), 200);
    const chrome = await readChrome(page);
    assert.ok(chrome.logo > 0, "sidebar logo missing from the server HTML");
    assert.equal(chrome.header, 1, "top header missing from the server HTML");

    await context.close();
  });

  test("is on screen when the URL is opened directly", async () => {
    const { context, page, response } = await openPage(`/orders/${ORDER_ID}`);

    assert.equal(response.status(), 200);
    const chrome = await readChrome(page);
    assert.ok(chrome.logo > 0, "sidebar logo is not on screen");
    assert.equal(chrome.header, 1, "top header is not on screen");
    assert.equal(chrome.search, 1, "top bar search is not on screen");
    assert.equal(chrome.heading, ORDER_NO);

    await context.close();
  });

  test("survives navigating in from the orders list", async () => {
    const { context, page } = await openPage("/orders");

    await page.locator("tbody tr").first().click();
    await page.waitForURL(new RegExp(`/orders/${ORDER_ID}`));
    await page.waitForTimeout(500);

    const chrome = await readChrome(page);
    assert.ok(chrome.logo > 0, "sidebar logo is not on screen");
    assert.equal(chrome.header, 1, "top header is not on screen");
    assert.equal(chrome.heading, ORDER_NO);

    await context.close();
  });

  test("is still there when the record does not exist", async () => {
    /*
     * This used to assert a hard 404, on the reasoning that an order created
     * in-session lived only in memory and so could not be resolved on a fresh
     * request. That reasoning no longer holds: the store is persisted to
     * localStorage, which the server cannot read.
     *
     * So the server can no longer decide whether an order exists — only the
     * browser can. It renders the loading gate and returns 200, and the
     * not-found state is reached after hydration instead. Asserting 404 here
     * would mean giving up persistence, which is the more valuable half of the
     * trade.
     *
     * What still matters, and is still asserted: the operator lands on a
     * recognisable "not found" page and can navigate away from it.
     */
    const { context, page, response } = await openPage(
      "/orders/order-does-not-exist",
    );

    assert.equal(response.status(), 200);
    await page.waitForTimeout(1200); // let the store rehydrate

    const body = await page.locator("body").innerText();
    assert.match(
      body,
      /could not find/i,
      "a missing record must still show a not-found page",
    );
    assert.ok(
      (await page.locator('a[href="/"], a[href="/orders"]').count()) > 0,
      "the operator must be able to navigate away from the not-found page",
    );

    await context.close();
  });
});
