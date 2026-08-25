"use client";

import * as React from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { refreshOperations } from "@/lib/api/mutations";
import { useDataStore } from "@/lib/store";

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
/**
 * How stale the cache may be before a navigation quietly refreshes it.
 *
 * Nothing in this browser can go out of date without going through the mutation
 * layer, which reloads as it writes. What this covers is somebody else's
 * change, on another machine — worth picking up, not worth waiting for.
 */
const STALE_AFTER_MS = 30_000;

export function StoreGate({ children }: { children: React.ReactNode }) {
  /*
   * Whether we have ever loaded, rather than whether we are loading now.
   *
   * This component wraps every admin screen, and it used to start each mount at
   * "loading" and re-download clients, orders, purchases, payments and settings
   * before rendering anything. Every click between screens therefore cost a
   * full round trip and a flash of placeholders, for data the browser was
   * already holding and had just finished drawing.
   *
   * So: if there is a dataset, show it immediately and refresh behind the
   * screen. Placeholders are for the one load that genuinely has nothing.
   */
  const loadedAt = useDataStore((s) => s.loadedAt);
  const [status, setStatus] = React.useState<"loading" | "ready" | "failed">(
    loadedAt ? "ready" : "loading",
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

    /*
     * A refresh that fails while we already have data is not worth a wiped
     * screen — the figures on it were true a moment ago and still are, near
     * enough. It goes to the console and the next attempt tries again.
     */
    const haveData = useDataStore.getState().loadedAt !== null;

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
        if (haveData) {
          console.warn("[amanat] background refresh failed", error);
          return;
        }
        setReason((error as Error)?.message ?? String(error));
        setStatus("failed");
      }
    }

    /*
     * Fresh enough is fresh enough. Re-asking on every navigation for data
     * seconds old is the cost with nothing bought.
     */
    /*
     * Read, not subscribed to.
     *
     * With `loadedAt` in this effect's dependencies, a successful load updated
     * the store, which re-ran the effect, whose cleanup set `cancelled` — and
     * the original run then skipped its own `setStatus("ready")` on the very
     * next line. The screen stayed on placeholders for ever while the data sat
     * loaded behind them. This runs once, on mount, and looks the value up
     * itself.
     */
    const cachedAt = useDataStore.getState().loadedAt;
    const fresh = cachedAt !== null && Date.now() - cachedAt < STALE_AFTER_MS;
    if (fresh) return;

    // Scheduled rather than called in the effect body, so the state change
    // never lands synchronously during the effect.
    const first = setTimeout(load, 0);
    return () => {
      cancelled = true;
      clearTimeout(first);
    };
  }, []);

  /*
   * Having data is what decides this, not a flag set by an effect.
   *
   * `status` began as the whole story, and it was wrong twice over: it is
   * initialised on this component's first render, but the server-seeded data
   * can arrive a moment later — so the gate sat on placeholders with the
   * dataset already in the store, waiting for a fetch it had correctly
   * decided not to make. Reading the store directly cannot fall out of step
   * with it, and it costs no effect and no extra render.
   */
  const hasData = loadedAt !== null;

  if (status === "failed" && !hasData) {
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

  if (status === "loading" && !hasData) {
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
