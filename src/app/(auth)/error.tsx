"use client";

import { Logo } from "@/components/brand/logo";
import { DatabaseError } from "@/components/shared/database-error";

/**
 * When the way in cannot be drawn.
 *
 * Reached before anybody has signed in, so the person looking at it may have no
 * idea the app has a database at all. What it replaces is a bare 500 — which is
 * what you got on a first visit if the connection string was missing or wrong,
 * at the exact moment there was nothing else to try.
 *
 * A missing schema is no longer one of the reasons: the app creates its own
 * tables now. What is left is genuinely not reachable.
 */
export default function AuthError({ reset }: { reset: () => void }) {
  return (
    <>
      <div className="mb-6 flex justify-center">
        <Logo />
      </div>
      <DatabaseError reset={reset} />
    </>
  );
}
