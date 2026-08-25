"use client";

import { AlertTriangleIcon, RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * What to say when the database will not answer.
 *
 * One component, rendered by every error boundary in the app, because the
 * advice does not change with the route — and because the version that existed
 * only under `(auth)` meant the dashboard still answered a stalled database
 * with a bare crash page carrying no advice at all.
 *
 * Written for the owner rather than a developer: four things to check, in the
 * order they are worth checking, and the one command that answers which.
 */
export function DatabaseError({ reset }: { reset: () => void }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start gap-3">
          <span className="bg-warning/10 text-warning flex size-9 shrink-0 items-center justify-center rounded-full">
            <AlertTriangleIcon className="size-4" />
          </span>
          <div className="min-w-0">
            <h1 className="font-semibold">Cannot reach the database</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              The app is running, but it cannot get to where your data lives,
              so there is nothing it can show you yet.
            </p>
          </div>
        </div>

        <div className="bg-muted/40 mt-4 rounded-lg p-3">
          <p className="text-xs font-medium">Worth checking, in order</p>
          <ol className="text-muted-foreground mt-2 grid gap-1.5 text-xs">
            <li>
              1. <span className="font-medium">Is the connection string
              set?</span> On Vercel it must be enabled for Production, not
              only Preview.
            </li>
            <li>
              2. <span className="font-medium">Is it the pooled one?</span> On
              Neon the host has <code className="text-[11px]">-pooler</code> in
              it and the string needs{" "}
              <code className="text-[11px]">sslmode=require</code>. On Supabase
              the direct host is IPv6-only and cannot be reached from Vercel at
              all — its pooler host ends{" "}
              <code className="text-[11px]">pooler.supabase.com</code>.
            </li>
            <li>
              3. <span className="font-medium">Is the password current?</span>{" "}
              Resetting it in the database console does not update Vercel.
            </li>
            <li>
              4. <span className="font-medium">Is the database awake?</span> A
              free Neon compute suspends when it is left alone, and wakes on
              the next request — so this may clear on its own. A free Supabase
              project pauses and has to be resumed by hand.
            </li>
          </ol>
        </div>

        <p className="text-muted-foreground mt-3 text-xs">
          Running <code className="text-[11px]">npm run db:check</code> locally
          says which of these it is.
        </p>

        <Button onClick={reset} className="mt-4 w-full">
          <RefreshCwIcon />
          Try again
        </Button>
      </CardContent>
    </Card>
  );
}
