"use client";

import * as React from "react";

import {
  clearNotifications as clearOnServer,
  listNotifications,
  markNotificationsRead as markReadOnServer,
} from "@/lib/server/intake";
import type { AppNotification } from "@/lib/types";

/**
 * The bell, fed from the database.
 *
 * Notifications used to live in whichever browser raised them, so a website
 * order placed by a customer appeared to nobody: the customer's own browser
 * wrote the event, and the shop's browser never saw it. They are office-wide
 * rows now, which is the whole point — one member of staff sees what happened
 * on another's machine, or on a customer's phone.
 *
 * Polled rather than pushed. A shop takes a handful of orders a day; a
 * websocket for that is a connection to keep alive, a reconnection path to get
 * right, and a serverless platform that does not want to hold either. Thirty
 * seconds is far inside the time it takes anyone to walk to the counter.
 */

const POLL_MS = 30_000;

export function useServerNotifications(): {
  events: AppNotification[];
  unread: number;
  markRead: () => Promise<void>;
  clear: () => Promise<void>;
} {
  const [events, setEvents] = React.useState<AppNotification[]>([]);

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const next = await listNotifications();
        if (!cancelled) setEvents(next);
      } catch {
        // A failed poll is not worth interrupting anyone over; the next one
        // runs in thirty seconds and the bell keeps showing what it last knew.
      }
    }

    /*
     * The first read is scheduled rather than called here. Starting a fetch in
     * the body of an effect is the shape React's compiler warns about, and the
     * distinction is real: everything below subscribes to something outside
     * React, and this joins them instead of racing the first render.
     */
    const first = setTimeout(load, 0);
    const timer = setInterval(load, POLL_MS);

    /*
     * Also on return to the tab. Somebody coming back from lunch should not
     * wait out the remainder of an interval to find out what arrived.
     */
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const unread = events.reduce((count, event) => count + (event.read ? 0 : 1), 0);

  return {
    events,
    unread,
    markRead: async () => {
      // Locally first, so the badge clears on the click rather than on the
      // round trip. The next poll confirms it.
      setEvents((current) => current.map((e) => (e.read ? e : { ...e, read: true })));
      await markReadOnServer();
    },
    clear: async () => {
      setEvents([]);
      await clearOnServer();
    },
  };
}
