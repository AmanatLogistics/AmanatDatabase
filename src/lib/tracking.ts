/**
 * Tracking numbers.
 *
 * Every order carries one. It is the only identifier a client ever sees, so it
 * is deliberately *not* the sequential `orderNo`: handing out `AS-2026-0148`
 * tells the holder both how many orders came before theirs and what to type to
 * read someone else's.
 *
 * Two rules, on purpose:
 *
 * - **What we generate** is tight: `PREFIX-YYYY-XXXXXX`, where the suffix is
 *   six symbols of a 32-character alphabet with I, L, O and U removed — the
 *   glyph pairs that get misread when a number is spelled out over WhatsApp or
 *   copied off a printed slip. 32^6 is about 1.07 billion values, so guessing
 *   one is impractical.
 * - **What an operator types** is loose: any reasonable reference of their own,
 *   `AM-1042`, `AM-2026-0001`, whatever the business already uses on paper.
 *   Refusing those would make "we give the tracking number manually" a lie.
 */

/** Crockford-style base 32: no I, L, O or U. */
const TRACKING_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

const SUFFIX_LENGTH = 6;

/** Fallback when the company profile has not set one. */
const DEFAULT_TRACKING_PREFIX = "AS";

/**
 * What a typed tracking number may look like.
 *
 * Letters, digits and hyphens; 3 to 32 characters; must start alphanumeric.
 * Deliberately permissive — the operator's own scheme is the point. The only
 * things refused are values that would break a URL or a lookup: blanks,
 * spaces and punctuation.
 */
const TRACKING_NUMBER_PATTERN = /^[A-Z0-9][A-Z0-9-]{2,31}$/;

export function isValidTrackingNumber(value: string): boolean {
  return TRACKING_NUMBER_PATTERN.test(value);
}

/** Normalise before storing or comparing, so case is never a source of clashes. */
export function normaliseTrackingNumber(value: string): string {
  return value.trim().toUpperCase();
}

export interface GenerateOptions {
  year: number;
  /** Company prefix, e.g. "AM". Falls back to "AS". */
  prefix?: string;
  /**
   * Injected so a caller can pass its own source — a test, or anything that
   * needs the same number twice.
   */
  random?: () => number;
}

export function generateTrackingNumber({
  year,
  prefix = DEFAULT_TRACKING_PREFIX,
  random = Math.random,
}: GenerateOptions): string {
  let suffix = "";
  for (let i = 0; i < SUFFIX_LENGTH; i += 1) {
    suffix += TRACKING_ALPHABET[Math.floor(random() * TRACKING_ALPHABET.length)];
  }
  const clean = normaliseTrackingNumber(prefix).replace(/[^A-Z0-9]/g, "");
  return `${clean || DEFAULT_TRACKING_PREFIX}-${year}-${suffix}`;
}

/**
 * Build a tracking number that is not already in `taken`.
 *
 * Uniqueness has no database to lean on yet (see SPEC.md §2.2), so this is a
 * best-effort check against the records we can see. It is not a guarantee.
 */
export function generateUniqueTrackingNumber(
  options: GenerateOptions & { taken: Iterable<string> },
): string {
  const used = new Set(options.taken);
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = generateTrackingNumber(options);
    if (!used.has(candidate)) return candidate;
  }
  throw new Error("could not generate an unused tracking number");
}
