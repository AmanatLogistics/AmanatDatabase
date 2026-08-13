import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

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
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let server;
let browser;
let baseUrl;

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

async function openPage(route, { javaScriptEnabled = true } = {}) {
  const context = await browser.newContext({
    javaScriptEnabled,
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
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
});

after(async () => {
  await browser?.close();
  server?.kill();
});

describe("app chrome on the order detail route", () => {
  test("is server-rendered, before any JavaScript runs", async () => {
    // JavaScript off, so this is exactly the HTML the server sent. If the route
    // ever falls outside (app)/layout.tsx, this is the case that notices.
    const { context, page, response } = await openPage("/orders/order-0100", {
      javaScriptEnabled: false,
    });

    assert.equal(response.status(), 200);
    const chrome = await readChrome(page);
    assert.ok(chrome.logo > 0, "sidebar logo missing from the server HTML");
    assert.equal(chrome.header, 1, "top header missing from the server HTML");

    await context.close();
  });

  test("is on screen when the URL is opened directly", async () => {
    const { context, page, response } = await openPage("/orders/order-0100");

    assert.equal(response.status(), 200);
    const chrome = await readChrome(page);
    assert.ok(chrome.logo > 0, "sidebar logo is not on screen");
    assert.equal(chrome.header, 1, "top header is not on screen");
    assert.equal(chrome.search, 1, "top bar search is not on screen");
    assert.match(chrome.heading, /^AS-\d{4}-\d+$/);

    await context.close();
  });

  test("survives navigating in from the orders list", async () => {
    const { context, page } = await openPage("/orders");

    await page.locator("tbody tr").first().click();
    await page.waitForURL(/\/orders\/order-/);
    await page.waitForTimeout(500);

    const chrome = await readChrome(page);
    assert.ok(chrome.logo > 0, "sidebar logo is not on screen");
    assert.equal(chrome.header, 1, "top header is not on screen");
    assert.match(chrome.heading, /^AS-\d{4}-\d+$/);

    await context.close();
  });

  test("is still there when the record does not exist", async () => {
    // An order created in-session lives only in the in-memory store, so opening
    // its URL in a fresh tab lands on the 404. The operator must still be able
    // to navigate away.
    const { context, page, response } = await openPage(
      "/orders/order-does-not-exist",
    );

    assert.equal(response.status(), 404, "a missing record must stay a hard 404");
    const chrome = await readChrome(page);
    assert.ok(chrome.logo > 0, "sidebar logo is not on screen on the 404");
    assert.equal(chrome.header, 1, "top header is not on screen on the 404");

    await context.close();
  });
});
