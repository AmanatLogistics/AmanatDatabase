"use client";

import * as React from "react";
import { PackageCheckIcon, SearchIcon } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { ProductThumb } from "@/components/shared/product-thumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePublicTracking } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

/**
 * The public order-tracking page.
 *
 * Deliberately a different visual register from the admin app: one centred
 * column, large type, no density, no chrome. A client opens this on a phone,
 * types the number we gave them, and confirms the thing on screen is the thing
 * they asked for.
 *
 * It renders only `PublicTrackingResult` (see `src/lib/api/queries.ts`), which
 * is the field allowlist. Nothing here reaches for the raw order.
 */
export function PublicTrackingScreen() {
  const [input, setInput] = React.useState("");
  /** Only set on submit, so the page does not look up as the client types. */
  const [submitted, setSubmitted] = React.useState("");

  const result = usePublicTracking(submitted);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(input.trim().toUpperCase());
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-10 sm:py-16">
      <div className="flex flex-col items-center gap-3 text-center">
        <Logo />
        <h1 className="text-2xl font-semibold tracking-tight">
          Track your order
        </h1>
        <p className="text-muted-foreground text-sm">
          Enter the tracking number we sent you.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="grid gap-3">
            <Label htmlFor="tracking-input">Tracking number</Label>
            <div className="flex gap-2">
              <Input
                id="tracking-input"
                value={input}
                onChange={(e) => setInput(e.target.value.toUpperCase())}
                placeholder="AS-2026-4F7K2Q"
                className="tabular h-11 text-base"
                autoComplete="off"
                spellCheck={false}
              />
              <Button type="submit" className="h-11 shrink-0" disabled={!input.trim()}>
                <SearchIcon />
                Track
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {submitted && !result && <NotFound />}
      {result && <Result result={result} />}
    </main>
  );
}

/**
 * One message for every failure.
 *
 * A number that does not exist and a number that is not even the right shape
 * produce exactly this, with no detail that would let someone tell the two
 * apart and walk the number space.
 */
function NotFound() {
  return (
    <Card data-testid="tracking-not-found">
      <CardContent className="pt-6 text-center">
        <p className="text-sm font-medium">We could not find that number.</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Check it against the message we sent you, or contact us and we will
          look it up.
        </p>
      </CardContent>
    </Card>
  );
}

function Result({
  result,
}: {
  result: NonNullable<ReturnType<typeof usePublicTracking>>;
}) {
  return (
    <div className="flex flex-col gap-4" data-testid="tracking-result">
      <Card>
        <CardContent className="flex flex-col gap-5 pt-6">
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">
              Tracking number
            </span>
            <span className="tabular text-lg font-semibold">
              {result.trackingNumber}
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Status</span>
            <span className="text-xl font-semibold" data-testid="tracking-status">
              {result.statusLabel}
            </span>
          </div>

          {result.arrivedAtOffice ? (
            <div className="border-success/40 bg-success/10 text-success flex items-start gap-2.5 rounded-lg border p-3">
              <PackageCheckIcon className="mt-0.5 size-5 shrink-0" />
              <p className="text-sm font-medium">
                Your order has arrived at our office and is ready for you to
                collect.
              </p>
            </div>
          ) : (
            <div className="text-muted-foreground rounded-lg border border-dashed p-3 text-sm">
              Your order has not reached our office yet. We will let you know as
              soon as it does.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h2 className="mb-3 text-sm font-semibold">
            {result.items.length > 1 ? "Your products" : "Your product"}
          </h2>
          <ul className="flex flex-col gap-3">
            {result.items.map((item, index) => (
              <li key={index} className="flex items-center gap-3">
                <ProductThumb
                  size="md"
                  category="other"
                  name={item.name}
                  imageUrl={item.imageUrl}
                />
                <div className="flex min-w-0 flex-col">
                  <span className="text-sm font-medium">{item.name}</span>
                  <span className="text-muted-foreground text-xs">
                    Quantity {item.qty}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h2 className="mb-3 text-sm font-semibold">Progress</h2>
          <ol className="flex flex-col gap-3">
            {result.timeline
              .slice()
              .reverse()
              .map((event, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span
                    className={
                      index === 0
                        ? "bg-brand-600 mt-1.5 size-2 shrink-0 rounded-full"
                        : "bg-muted-foreground/40 mt-1.5 size-2 shrink-0 rounded-full"
                    }
                  />
                  <div className="flex min-w-0 flex-col">
                    <span className="text-sm font-medium">
                      {event.statusLabel}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {formatDateTime(event.at)}
                    </span>
                  </div>
                </li>
              ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
