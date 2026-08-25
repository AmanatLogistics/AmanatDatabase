"use client";

import { Logo } from "@/components/brand/logo";
import { DatabaseError } from "@/components/shared/database-error";

/**
 * The catch-all, for every route that does not bring its own.
 *
 * Without this, only the sign-in pages explained a database that would not
 * answer; the dashboard and the tracking page rendered Next's bare crash
 * screen, which says nothing an owner can act on. Now the same four checks
 * appear wherever the failure happens.
 *
 * Nearly every error this app can raise at request time is the database not
 * answering — it is the only thing a page waits on — so leading with that is
 * honest rather than a guess. `reset` re-runs the render, which is the right
 * first move when the cause was a database still waking up.
 */
export default function AppError({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4">
      <div className="mb-6 flex justify-center">
        <Logo />
      </div>
      <DatabaseError reset={reset} />
    </div>
  );
}
