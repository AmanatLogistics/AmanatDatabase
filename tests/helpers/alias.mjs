import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Teach Node the `@/` path alias, so a test can import application code.
 *
 * The app is built by Next, which resolves `@/x` to `src/x` and picks the file
 * extension. Plain Node does neither, so importing anything real from a test
 * fails on the first `@/` import — and the failure surfaces as "test did not
 * finish before its parent", which says nothing about the cause.
 *
 * Registered with `--import ./tests/helpers/alias-register.mjs`, and paired
 * with `--conditions=react-server` so the `server-only` package resolves to its
 * empty build instead of the copy that throws on purpose.
 */

const ROOT = new URL("../../", import.meta.url);

/** Next resolves a bare path to any of these; Node resolves none of them. */
const CANDIDATES = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];

export function resolve(specifier, context, next) {
  if (!specifier.startsWith("@/")) return next(specifier, context);

  const base = new URL(`src/${specifier.slice(2)}`, ROOT);
  for (const suffix of CANDIDATES) {
    const candidate = new URL(`${base.pathname}${suffix}`, ROOT);
    if (suffix && existsSync(fileURLToPath(candidate))) {
      return next(candidate.href, context);
    }
  }
  return next(base.href, context);
}
