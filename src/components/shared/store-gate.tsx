"use client";

import * as React from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { refreshOperations } from "@/lib/api/mutations";

/**
 * Holds a screen back until the operations data has arrived.
 *
 * Everything below reads clients, orders, purchases and payments. Those used to
 * live in this browser and load in a millisecond; they come from the database
 * now, so the wait is real and the placeholder has to mean it.
 *
 * The data is fetched once per mount and kept in the Zustand store as a cache.
 * Every write goes through `src/lib/api/mutations.ts`, which reloads it — so
 * the cache is only ever as stale as the last thing this browser did. What it
 * does not do is notice somebody else's change: for that, reload the page. A
 * shop where two people edit the same order in the same minute would need
 * more, and this one does not.
 */
export function StoreGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = React.useState<"loading" | "ready" | "failed">(
    "loading",
  );
  /*
   * Kept and shown, not swallowed. "Could not reach the database" is true and
   * useless — it is the same sentence whether the password is wrong, the
   * project is asleep or a query took too long, and those need different
   * answers. This screen is behind a staff login, so the person reading it is
   * the person who can act on it.
   */
  const [reason, setReason] = React.useState<string>("");

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        /*
         * A limit on this side as well as the server's.
         *
         * The server action has its own deadline, but the browser cannot rely
         * on being told: if the function is killed by the platform, or the
         * response never arrives, the promise simply never settles and this
         * screen shows placeholders for ever. A person then cannot tell "still
         * loading" from "never coming", and there is nothing on screen to act
         * on. Fifteen seconds is far longer than a healthy load and far shorter
         * than for ever.
         */
        await Promise.race([
          refreshOperations(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("timed out")), 15_000),
          ),
        ]);
        if (!cancelled) setStatus("ready");
      } catch (error) {
        if (cancelled) return;
        setReason((error as Error)?.message ?? String(error));
        setStatus("failed");
      }
    }

    // Scheduled rather than called in the effect body, so the state change
    // never lands synchronously during the effect.
    const first = setTimeout(load, 0);
    return () => {
      cancelled = true;
      clearTimeout(first);
    };
  }, []);

  if (status === "failed") {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="font-medium">Could not load your data.</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Nothing has been lost. The server refused this one request, and the
          reason it gave is below.
        </p>
        {reason && (
          <pre className="bg-muted/50 text-muted-foreground mt-3 max-h-48 overflow-auto rounded-lg p-3 text-left text-[11px] whitespace-pre-wrap">
            {reason}
          </pre>
        )}
        <p className="text-muted-foreground mt-3 text-xs">
          For the full picture — every step timed, and which one failed — open{" "}
          <a
            href="/api/health"
            className="text-brand-700 dark:text-brand-300 underline-offset-2 hover:underline"
          >
            /api/health
          </a>
          .
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="text-brand-700 dark:text-brand-300 mt-3 text-sm underline-offset-2 hover:underline"
        >
          Reload
        </button>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="space-y-4" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading your data…</span>
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return <>{children}</>;
}
