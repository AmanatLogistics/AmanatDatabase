"use client";

import { useSyncExternalStore } from "react";

import { useDataStore } from "@/lib/store";

/**
 * Has the persisted store finished loading?
 *
 * The server renders from the seed data, because it cannot see the browser's
 * localStorage. If the first client render used the persisted data instead, the
 * two would disagree and React would report a hydration mismatch — so screens
 * hold off until this returns true.
 *
 * `useSyncExternalStore` is what makes that safe: its third argument is the
 * server snapshot, pinned to `false`, so hydration renders the same "not ready"
 * markup the server sent and React switches over on the next commit. Reading
 * the flag with `useState` + `useEffect` would flip it *during* hydration and
 * reintroduce the mismatch this exists to avoid.
 */
export function useStoreHydrated(): boolean {
  return useSyncExternalStore(
    (onChange) => useDataStore.persist.onFinishHydration(onChange),
    () => useDataStore.persist.hasHydrated(),
    () => false,
  );
}

/**
 * Kick off rehydration once, from the browser only.
 *
 * Called at module scope by the gate component: it must run before the first
 * paint that depends on the data, and it must never run on the server, where
 * localStorage does not exist.
 */
export function startHydration(): void {
  if (typeof window === "undefined") return;
  if (useDataStore.persist.hasHydrated()) return;
  void useDataStore.persist.rehydrate();
  listenForOtherTabs();
}

let listening = false;

/**
 * Keep other tabs current.
 *
 * The browser fires `storage` in every *other* tab when one of them writes, so
 * an order placed in one tab reaches the rest without anyone refreshing. This
 * is as close to live as a browser-only app gets: it does not reach another
 * device or another member of staff, which needs a server.
 */
function listenForOtherTabs(): void {
  if (listening) return;
  listening = true;

  window.addEventListener("storage", (event) => {
    if (event.key !== "amanat-shopping-data") return;
    void useDataStore.persist.rehydrate();
  });
}
