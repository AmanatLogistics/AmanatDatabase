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

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        await refreshOperations();
        if (!cancelled) setStatus("ready");
      } catch {
        if (!cancelled) setStatus("failed");
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
        <p className="font-medium">Could not reach the database.</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Nothing has been lost — this screen simply has nothing to show until
          the connection comes back. Try reloading in a moment.
        </p>
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
