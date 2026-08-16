"use client";

import * as React from "react";
import {
  CheckIcon,
  MapPinIcon,
  PackageCheckIcon,
  PhoneIcon,
  SearchIcon,
} from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { ProductThumb } from "@/components/shared/product-thumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  usePublicPickupDetails,
  usePublicTracking,
  type PublicPickupDetails,
  type PublicTrackingResult,
} from "@/lib/api";
import { CLIENT_PROGRESS_STAGES } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";
import { startHydration, useStoreHydrated } from "@/lib/hydration";
import { cn } from "@/lib/utils";

startHydration();

/**
 * The customer's page — the only screen anyone outside the business ever sees.
 *
 * A different register from the admin app on purpose: one column, large type,
 * no density, no navigation, nothing to learn. A client opens it on a phone,
 * types the number we gave them, and gets one question answered — where is my
 * thing, and is it the right thing?
 *
 * It renders `PublicTrackingResult` and never touches the raw order, so the
 * allowlist in `src/lib/api/queries.ts` is the whole story about what a
 * customer can see. No prices, no other clients, no internal notes.
 *
 * WIRING THE BACKEND — the one thing to change later:
 * `usePublicTracking` is the only order data this page reads. Replace that
 * hook's body with a fetch of `GET /api/track/:trackingNumber` returning the
 * same shape, and the page starts working for real customers with nothing here
 * touched. Until that exists a lookup can only find orders saved in the
 * visitor's own browser, which is why customers cannot be sent here yet.
 */
export function PublicTrackingScreen({
  initialNumber = "",
}: {
  /** From `?n=` — lets a link open straight onto one order. */
  initialNumber?: string;
}) {
  const hydrated = useStoreHydrated();
  const [input, setInput] = React.useState(initialNumber.toUpperCase());
  /** Only set on submit, so the page does not search as the client types. */
  const [submitted, setSubmitted] = React.useState(initialNumber.toUpperCase());

  const result = usePublicTracking(submitted);
  const pickup = usePublicPickupDetails();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(input.trim().toUpperCase());
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 py-8 sm:py-14">
      <header className="flex flex-col items-center gap-3 text-center">
        <Logo />
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Track your order
        </h1>
        <p className="text-muted-foreground text-sm">
          Enter the tracking number we sent you.
        </p>
      </header>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="grid gap-2.5">
            <Label htmlFor="tracking-input">Tracking number</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="tracking-input"
                value={input}
                onChange={(e) => setInput(e.target.value.toUpperCase())}
                placeholder="AM-2026-0001"
                className="tabular h-12 text-base"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                enterKeyHint="search"
              />
              <Button
                type="submit"
                className="h-12 shrink-0 px-6"
                disabled={!input.trim()}
              >
                <SearchIcon />
                Track
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {hydrated && submitted && !result && <NotFound />}
      {hydrated && result && <Result result={result} pickup={pickup} />}
    </main>
  );
}

/**
 * One message for every failure.
 *
 * A number that does not exist and a number that is not even the right shape
 * produce exactly this, with nothing that would let someone tell the two apart
 * and walk the number space.
 */
function NotFound() {
  return (
    <Card data-testid="tracking-not-found">
      <CardContent className="pt-6 text-center">
        <p className="text-base font-medium">We could not find that number.</p>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Check it against the message we sent you, or contact us and we will
          look it up for you.
        </p>
      </CardContent>
    </Card>
  );
}

function Result({
  result,
  pickup,
}: {
  result: PublicTrackingResult;
  pickup: PublicPickupDetails;
}) {
  return (
    <div className="flex flex-col gap-4" data-testid="tracking-result">
      {/* Where is it — the question they came to ask, answered first. */}
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-muted-foreground text-xs">Tracking number</p>
              <p className="tabular text-lg font-semibold">
                {result.trackingNumber}
              </p>
            </div>
            <div className="text-right">
              <p className="text-muted-foreground text-xs">Ordered</p>
              <p className="text-sm font-medium">{formatDate(result.placedAt)}</p>
            </div>
          </div>

          <div>
            <p
              className="text-xl font-semibold sm:text-2xl"
              data-testid="tracking-status"
            >
              {result.statusLabel}
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              {result.statusMessage}
            </p>
          </div>

          {result.arrivedAtOffice && !result.delivered && (
            <div className="border-success/40 bg-success/10 text-success flex items-start gap-2.5 rounded-lg border p-3">
              <PackageCheckIcon className="mt-0.5 size-5 shrink-0" />
              <p className="text-sm font-medium">
                Your order is at our office and ready to collect.
              </p>
            </div>
          )}
          {result.delivered && result.deliveredAt && (
            <p className="text-muted-foreground text-sm">
              Handed over on {formatDate(result.deliveredAt)}.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Progress — the five stages a customer cares about, not the nine staff see. */}
      {result.progressIndex !== null && (
        <Card>
          <CardContent className="pt-6">
            <h2 className="mb-4 text-sm font-semibold">Progress</h2>
            <ol className="flex flex-col gap-0" data-testid="tracking-progress">
              {CLIENT_PROGRESS_STAGES.map((stage, index) => {
                const reached = index <= (result.progressIndex ?? -1);
                const current = index === result.progressIndex;
                const last = index === CLIENT_PROGRESS_STAGES.length - 1;
                return (
                  <li key={stage.key} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-semibold transition-colors",
                          reached
                            ? "border-brand-600 bg-brand-600 text-primary-foreground"
                            : "border-muted-foreground/25 text-muted-foreground/50",
                        )}
                      >
                        {reached ? <CheckIcon className="size-3.5" /> : index + 1}
                      </span>
                      {!last && (
                        <span
                          className={cn(
                            "w-0.5 flex-1",
                            index < (result.progressIndex ?? -1)
                              ? "bg-brand-600"
                              : "bg-muted-foreground/20",
                          )}
                        />
                      )}
                    </div>
                    <div className={cn("pb-5", last && "pb-0")}>
                      <p
                        className={cn(
                          "text-sm",
                          current
                            ? "font-semibold"
                            : reached
                              ? "font-medium"
                              : "text-muted-foreground",
                        )}
                      >
                        {stage.label}
                      </p>
                      {current && (
                        <p className="text-muted-foreground text-xs">
                          Where your order is now
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      )}

      {/* What they ordered, so they can confirm it is theirs. */}
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

      {/* Collection details, once there is something to collect. */}
      {result.arrivedAtOffice && (
        <Card>
          <CardContent className="pt-6">
            <h2 className="mb-3 text-sm font-semibold">
              {result.delivered ? "Collected from" : "Where to collect it"}
            </h2>
            <div className="flex items-start gap-2.5">
              <MapPinIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
              <div className="text-sm">
                <p className="font-medium">{pickup.companyName}</p>
                <p className="text-muted-foreground">{pickup.addressLine1}</p>
                <p className="text-muted-foreground">
                  {pickup.addressLine2}, {pickup.city}
                </p>
              </div>
            </div>
            <div className="mt-3">
              <Button variant="outline" size="sm" asChild>
                <a href={`tel:${pickup.phone.replace(/\s/g, "")}`}>
                  <PhoneIcon />
                  {pickup.phone}
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* The history, newest first. */}
      {result.timeline.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <h2 className="mb-3 text-sm font-semibold">History</h2>
            <ol className="flex flex-col gap-3">
              {result.timeline
                .slice()
                .reverse()
                .map((event, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <span
                      className={cn(
                        "mt-1.5 size-2 shrink-0 rounded-full",
                        index === 0 ? "bg-brand-600" : "bg-muted-foreground/40",
                      )}
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
      )}

      <p className="text-muted-foreground text-center text-xs">
        Questions about this order? Call or WhatsApp {pickup.whatsapp}.
      </p>
    </div>
  );
}
