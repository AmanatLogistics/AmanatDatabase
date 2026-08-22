"use client";

/**
 * Who is doing this.
 *
 * Purchases record who bought, payments record who took the money, and every
 * timeline entry records who moved it. Those were three invented names left
 * over from the demo dataset, which meant a real payment was attributed to a
 * person who does not exist.
 *
 * Mutations are plain functions rather than hooks, so they cannot read the
 * session context. The signed-in name is parked here instead, by the provider
 * that already has it.
 *
 * Browser only, deliberately: a module-level value on the server is shared
 * between every request, and one person's name would end up on another's
 * records. Nothing reads this server-side — mutations run in the browser.
 */

const FALLBACK = "Staff";

let current = FALLBACK;

export function setActor(name: string): void {
  if (typeof window === "undefined") return;
  current = name.trim() || FALLBACK;
}

/** The signed-in person's name, or a neutral label before one is known. */
export function actorName(): string {
  return current;
}
