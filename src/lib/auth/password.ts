import "server-only";

import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
) => Promise<Buffer>;

/**
 * Password hashing, with what Node already has.
 *
 * scrypt is deliberately slow and memory-hungry, which is the point: it costs
 * an attacker with the hashes roughly the same per guess as it costs us per
 * sign-in. bcrypt or argon2 would do as well; neither is worth a dependency
 * when this ships in the standard library.
 *
 * The parameters are stored alongside the hash rather than hard-coded into the
 * comparison, so raising the cost later does not lock anybody out — old hashes
 * keep verifying with the parameters they were made with.
 */

const N = 16384; // CPU/memory cost
const R = 8; // block size
const P = 1; // parallelisation
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await scrypt(password.normalize("NFKC"), salt, KEY_LENGTH);
  return [
    "scrypt",
    N,
    R,
    P,
    salt.toString("base64"),
    key.toString("base64"),
  ].join("$");
}

/**
 * Does this password match this stored hash?
 *
 * Never throws on a malformed hash — it returns false, so a corrupt row reads
 * as "wrong password" rather than a 500 that tells the world something about
 * the account.
 */
export async function verifyPassword(
  password: string,
  stored: string | null,
): Promise<boolean> {
  if (!stored) return false;

  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const keylen = Buffer.from(parts[5], "base64").length;
  if (keylen === 0) return false;

  try {
    const expected = Buffer.from(parts[5], "base64");
    const actual = await scrypt(
      password.normalize("NFKC"),
      Buffer.from(parts[4], "base64"),
      keylen,
    );
    // Constant time: a plain === leaks how much of the hash matched.
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
