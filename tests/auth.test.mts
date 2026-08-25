import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium, type Browser } from "playwright";
import postgres from "postgres";

import { SESSION_COOKIE, clearStaff, signInDirectly } from "./helpers/session.mjs";

/**
 * The door.
 *
 * Everything under `(app)`, `(shop)` and `(print)` holds real clients, real
 * money and printable invoices with people's addresses on them. None of it may
 * be reachable without signing in — and the customer surfaces must stay
 * reachable without an account, because customers do not have one.
 *
 * These go through a real browser against a real database on purpose. The
 * failure mode being guarded against is a route quietly ending up outside the
 * guard, which only a request can prove.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATABASE_URL = process.env.DATABASE_URL;
const needsDatabase = { skip: DATABASE_URL ? false : "DATABASE_URL is not set" };

/** Every route that must never answer to a stranger. */
const PRIVATE = [
  "/orders",
  "/orders/new",
  "/clients",
  "/clients/new",
  "/purchases",
  "/payments",
  "/finance",
  "/finance/balances",
  "/documents",
  "/settings",
  "/settings/team",
];

/** Every route a customer must be able to reach without one. */
const PUBLIC = ["/track"];

/**
 * The shop, which is off by default.
 *
 * Off means absent, not merely hidden: these answer 404 to everyone, signed in
 * or not. That is a stronger guarantee than the redirect the rest of PRIVATE
 * gets, so it is asserted separately rather than folded into either list —
 * checking them for a login redirect would fail, and checking them as public
 * would pass for entirely the wrong reason.
 */
const SHOP_PUBLIC = ["/store", "/store/cart"];
const SHOP_PRIVATE = ["/shop", "/shop/products"];

let server: ReturnType<typeof spawn> | undefined;
let browser: Browser | undefined;
let baseUrl: string;

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.unref();
    probe.on("error", reject);
    probe.listen(0, () => {
      const address = probe.address() as { port: number };
      probe.close(() => resolve(address.port));
    });
  });
}

async function waitForServer(url: string, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  throw new Error(`server at ${url} did not come up`);
}

async function launchChromium(): Promise<Browser> {
  try {
    return await chromium.launch();
  } catch (error) {
    const fallback = "/opt/pw-browsers/chromium";
    if (!existsSync(fallback)) throw error;
    return chromium.launch({ executablePath: fallback });
  }
}

/** Where did a visit to `route` actually end up? */
async function landsOn(route: string, token?: string): Promise<string> {
  const context = await browser!.newContext();
  if (token) {
    await context.addCookies([
      { name: SESSION_COOKIE, value: token, url: baseUrl },
    ]);
  }
  const page = await context.newPage();
  await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
  const landed = new URL(page.url()).pathname;
  await context.close();
  return landed;
}

/** What HTTP status does `route` answer with? */
async function statusOf(route: string, token?: string): Promise<number> {
  const context = await browser!.newContext();
  if (token) {
    await context.addCookies([
      { name: SESSION_COOKIE, value: token, url: baseUrl },
    ]);
  }
  const page = await context.newPage();
  const response = await page.goto(`${baseUrl}${route}`, {
    waitUntil: "domcontentloaded",
  });
  const status = response?.status() ?? 0;
  await context.close();
  return status;
}

before(async () => {
  if (!DATABASE_URL) return;

  if (!existsSync(path.join(ROOT, ".next", "BUILD_ID"))) {
    await new Promise<void>((resolve, reject) => {
      const child = spawn("npx", ["next", "build"], {
        cwd: ROOT,
        stdio: "inherit",
      });
      child.on("error", reject);
      child.on("exit", (code) =>
        code === 0 ? resolve() : reject(new Error(`build exited ${code}`)),
      );
    });
  }

  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;
  server = spawn("npx", ["next", "start", "-p", String(port)], {
    cwd: ROOT,
    stdio: "ignore",
    env: { ...process.env, DATABASE_URL },
  });

  await waitForServer(baseUrl);
  browser = await launchChromium();
});

after(async () => {
  await browser?.close();
  server?.kill();
});

describe("the staff login", needsDatabase, () => {
  test("nothing private answers to a stranger", async () => {
    // With an owner registered, a stranger is sent to sign in rather than set up.
    await clearStaff(DATABASE_URL!);
    await signInDirectly(DATABASE_URL!);

    for (const route of PRIVATE) {
      assert.equal(
        await landsOn(route),
        "/login",
        `${route} answered without a session`,
      );
    }
  });

  test("a stranger at the front door is sent to tracking, not to a login form", async () => {
    await clearStaff(DATABASE_URL!);
    await signInDirectly(DATABASE_URL!);

    /*
     * The whole public face of this app is "where is my parcel". Someone who
     * opens the site is a customer far more often than a member of staff, and
     * sending them to a password prompt hides the one thing they came for.
     * Staff carry a session and never see this.
     */
    assert.equal(await landsOn("/"), "/track");
  });

  test("the shop is absent, not merely hidden", async () => {
    await clearStaff(DATABASE_URL!);
    const { token } = await signInDirectly(DATABASE_URL!);

    /*
     * The storefront is public, so nothing redirects it — it answers 404 at its
     * own URL, to everyone. That status is the whole assertion.
     */
    for (const route of SHOP_PUBLIC) {
      assert.equal(await statusOf(route), 404, `${route} answered to a customer`);
      assert.equal(
        await statusOf(route, token),
        404,
        `${route} answered to a signed-in member of staff`,
      );
    }

    /*
     * The shop admin is private as well as switched off. A stranger is turned
     * away by the proxy before the route is reached and never learns either
     * way; it is the operator, who *is* allowed in, who must find nothing.
     */
    for (const route of SHOP_PRIVATE) {
      assert.equal(
        await statusOf(route, token),
        404,
        `${route} answered to a signed-in member of staff while switched off`,
      );
      assert.equal(
        await landsOn(route),
        "/login",
        `${route} did not send a stranger to sign in`,
      );
    }
  });

  test("the customer surfaces stay open", async () => {
    await clearStaff(DATABASE_URL!);
    await signInDirectly(DATABASE_URL!);

    for (const route of PUBLIC) {
      assert.equal(
        await landsOn(route),
        route,
        `${route} was closed to a customer who has no account`,
      );
    }
  });

  test("a made-up session cookie is not a session", async () => {
    await clearStaff(DATABASE_URL!);
    await signInDirectly(DATABASE_URL!);

    /*
     * The guard in `proxy.ts` only checks that a cookie is present, which
     * anyone can arrange. This is the case that proves something behind it
     * actually verifies the token.
     */
    assert.equal(await landsOn("/clients", "not-a-real-token"), "/login");
  });

  test("a real session gets in", async () => {
    await clearStaff(DATABASE_URL!);
    const { token } = await signInDirectly(DATABASE_URL!);

    assert.equal(await landsOn("/clients", token), "/clients");
    assert.equal(await landsOn("/", token), "/");
  });

  test("signing out kills the token everywhere, not just in that browser", async () => {
    await clearStaff(DATABASE_URL!);
    const { token } = await signInDirectly(DATABASE_URL!);
    assert.equal(await landsOn("/clients", token), "/clients");

    // What signing out does: delete the row. A self-contained token could not
    // be withdrawn like this, which is why sessions live in the database.
    const sql = postgres(DATABASE_URL!, { max: 1, onnotice: () => {} });
    await sql`DELETE FROM sessions`;
    await sql.end();

    assert.equal(await landsOn("/clients", token), "/login");
  });

  test("a deactivated account stops being able to sign in", async () => {
    await clearStaff(DATABASE_URL!);
    const { token, staffId } = await signInDirectly(DATABASE_URL!);
    assert.equal(await landsOn("/clients", token), "/clients");

    const sql = postgres(DATABASE_URL!, { max: 1, onnotice: () => {} });
    await sql`UPDATE staff SET active = false WHERE id = ${staffId}`;
    await sql.end();

    // The session row still exists. It stops working anyway, which is what
    // "remove someone's access this afternoon" has to mean.
    assert.equal(await landsOn("/clients", token), "/login");
  });

  test("with nobody registered the app asks for an owner, and only once", async () => {
    await clearStaff(DATABASE_URL!);
    assert.equal(await landsOn("/"), "/setup");
    assert.equal(await landsOn("/orders"), "/setup");

    await signInDirectly(DATABASE_URL!);
    // Now that somebody owns it, the page that mints an owner is gone.
    assert.equal(await landsOn("/setup"), "/login");
  });
});
