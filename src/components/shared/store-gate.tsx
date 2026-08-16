"use client";

import * as React from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { startHydration, useStoreHydrated } from "@/lib/hydration";

startHydration();

/**
 * Holds a screen back until the persisted store has loaded.
 *
 * Everything below this reads the operator's saved data, which only exists in
 * the browser. Rendering it during hydration would put different content on
 * screen from the HTML the server sent.
 *
 * The placeholder is deliberately plain — this resolves in a few milliseconds
 * from localStorage, so anything more elaborate would flash.
 */
export function StoreGate({ children }: { children: React.ReactNode }) {
  const hydrated = useStoreHydrated();

  if (!hydrated) {
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
