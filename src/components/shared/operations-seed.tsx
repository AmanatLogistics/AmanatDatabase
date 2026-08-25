"use client";

import { useDataStore } from "@/lib/store";
import type { OperationsData } from "@/lib/server/operations";

/**
 * Put the server's data into the store before the first paint.
 *
 * The admin used to ship an empty shell and then ask for its data from the
 * browser: HTML, then JavaScript, then hydration, then a server action, and
 * only then a figure on the screen. Every one of those is a wait, and they
 * happen in order — which is why the dashboard painted placeholders for
 * seconds while the database answered every query in single digit
 * milliseconds. The page was not waiting on the data. It was waiting on the
 * round trip it took to ask for it.
 *
 * The layout already reads the session on the server, so it can read the rest
 * at the same time and hand it down. This is where it lands, and the storefront
 * has always done exactly this with its catalogue.
 *
 * Seeded during render rather than in an effect. An effect runs *after* the
 * first paint, which would put the placeholders back for a frame and give away
 * the whole point.
 *
 * `now` comes from the server rather than being read here. Both sides then
 * compute "this month" from the same instant, and the figures the server
 * rendered are the figures the browser hydrates — the alternative is a
 * mismatch, at midnight or on a slow connection.
 */
export function OperationsSeed({
  data,
  now,
}: {
  data: OperationsData;
  now: string;
}) {
  const loadedAt = useDataStore((s) => s.loadedAt);

  if (loadedAt === null) {
    useDataStore.setState({
      clients: data.clients,
      orders: data.orders,
      purchases: data.purchases,
      payments: data.payments,
      settings: data.settings,
      today: new Date(now),
      // Derived from the server's instant, not read here: a clock call during
      // render is impure, and this has to be the same on both sides anyway.
      loadedAt: Date.parse(now),
    });
  }

  return null;
}
