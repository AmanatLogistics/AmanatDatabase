import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  APP_URL_VARS,
  DIRECT_URL_VARS,
  describeUrl,
  explainConnectionError,
  findDatabaseUrl,
  isDirectSupabaseHost,
} from "../src/db/url.ts";

/**
 * Reading the environment, and explaining what went wrong.
 *
 * These exist because of a real afternoon lost to `getaddrinfo ENOTFOUND
 * db.xxxx.supabase.co` — a message that is accurate, useless, and sends you
 * looking for a typo in a hostname that is spelled correctly.
 */

describe("finding the connection string", () => {
  test("a hand-set DATABASE_URL wins", () => {
    const found = findDatabaseUrl(APP_URL_VARS, {
      DATABASE_URL: "postgresql://a@h/db",
      POSTGRES_URL: "postgresql://b@h/db",
    });
    assert.equal(found?.name, "DATABASE_URL");
  });

  test("the Supabase integration's POSTGRES_URL is picked up on its own", () => {
    // The integration never creates DATABASE_URL. Reading only that name meant
    // a correctly connected project still reported nothing configured.
    const found = findDatabaseUrl(APP_URL_VARS, {
      POSTGRES_URL: "postgresql://b@h/db",
    });
    assert.equal(found?.name, "POSTGRES_URL");
  });

  test("migrations prefer a direct connection over a pooled one", () => {
    const found = findDatabaseUrl(DIRECT_URL_VARS, {
      DATABASE_URL: "postgresql://a@pooler:6543/db",
      POSTGRES_URL_NON_POOLING: "postgresql://a@direct:5432/db",
    });
    assert.equal(found?.name, "POSTGRES_URL_NON_POOLING");
  });

  test("an empty string is not a connection string", () => {
    assert.equal(
      findDatabaseUrl(APP_URL_VARS, { DATABASE_URL: "   " }),
      null,
    );
  });

  test("printing a URL never prints the password", () => {
    const shown = describeUrl(
      "postgresql://postgres.abc:sup3rs3cret@aws-0-us-east-1.pooler.supabase.com:6543/postgres",
    );
    assert.ok(!shown.includes("sup3rs3cret"), `password leaked: ${shown}`);
    assert.match(shown, /pooler\.supabase\.com:6543/);
  });
});

describe("telling the IPv6-only host apart from the pooler", () => {
  test("the direct host is recognised", () => {
    assert.ok(
      isDirectSupabaseHost(
        "postgresql://postgres:pw@db.svmfblqdiyxjnarageno.supabase.co:5432/postgres",
      ),
    );
  });

  test("the pooler is not mistaken for it", () => {
    assert.equal(
      isDirectSupabaseHost(
        "postgresql://postgres.abc:pw@aws-0-us-east-1.pooler.supabase.com:6543/postgres",
      ),
      false,
    );
  });

  test("nor is anything else", () => {
    assert.equal(isDirectSupabaseHost("postgresql://u:p@localhost:5432/db"), false);
    assert.equal(isDirectSupabaseHost("not a url"), false);
  });
});

describe("explaining a connection failure", () => {
  const directUrl =
    "postgresql://postgres:pw@db.svmfblqdiyxjnarageno.supabase.co:5432/postgres";

  test("the exact error Vercel produced says what to change", () => {
    // Reproduced from a real deployment log.
    const error = Object.assign(new Error("Failed query: select count(*)"), {
      cause: Object.assign(
        new Error("getaddrinfo ENOTFOUND db.svmfblqdiyxjnarageno.supabase.co"),
        { code: "ENOTFOUND" },
      ),
    });

    const explained = explainConnectionError(error, directUrl);
    assert.match(explained, /IPv6/);
    assert.match(explained, /pooler/i);
    assert.match(explained, /Transaction pooler/);
    assert.ok(!explained.includes("pw"), "the password must not be echoed back");
  });

  test("a wrong password is named as a wrong password", () => {
    const error = Object.assign(new Error("Failed query"), {
      cause: new Error('password authentication failed for user "postgres"'),
    });
    const explained = explainConnectionError(error, directUrl);
    assert.match(explained, /Wrong password/);
    // The pooler needs a different username, which is the usual trap here.
    assert.match(explained, /postgres\.<project-ref>/);
  });

  test("a refused connection is not blamed on IPv6", () => {
    const error = Object.assign(new Error("Failed query"), {
      cause: Object.assign(new Error("connect ECONNREFUSED"), {
        code: "ECONNREFUSED",
      }),
    });
    const explained = explainConnectionError(error, directUrl);
    assert.doesNotMatch(explained, /IPv6/);
    assert.match(explained, /paused|port/i);
  });

  test("an error it has nothing to add to is passed through unchanged", () => {
    const error = Object.assign(new Error("Failed query"), {
      cause: new Error("relation \"staff\" does not exist"),
    });
    assert.match(
      explainConnectionError(error, directUrl),
      /relation "staff" does not exist/,
    );
  });
});
