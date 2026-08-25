"use client";

import * as React from "react";
import Link from "next/link";
import {
  CheckIcon,
  ClockIcon,
  MapPinIcon,
  PackageCheckIcon,
  PhoneIcon,
  Loader2Icon,
  SearchIcon,
  ShoppingBagIcon,
} from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { ProductThumb } from "@/components/shared/product-thumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  usePublicPickupDetails,
  type PublicPickupDetails,
  type PublicTrackingResult,
} from "@/lib/api";
import { trackByReference } from "@/lib/server/shop";
import { CLIENT_PROGRESS_STAGES } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";
import { startHydration, useStoreHydrated } from "@/lib/hydration";
import { cn } from "@/lib/utils";

startHydration();

/**
 * The customer's page — the only screen anyone outside the business ever sees.
 *
 * It renders `PublicTrackingResult` and never touches the raw order.
 * `trackByReference` in `src/lib/server/shop.ts` is the only order data this
 * page can reach, it runs on the server, and it builds its answer by naming the
 * fields a customer may see rather than by removing the ones they may not — so
 * a column added to `orders` tomorrow is absent here by default. No prices, no
 * other clients, no phone numbers, no internal notes.
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
  const [result, setResult] = React.useState<PublicTrackingResult | null>(null);
  const [searching, setSearching] = React.useState(false);

  const pickup = usePublicPickupDetails();

  /*
   * The lookup runs on the server against the shop's database. It used to read
   * the visitor's own browser storage, which meant it could only ever find an
   * order for the person who created it — never for the customer holding the
   * reference, which is the only person who needs it.
   */
  const search = React.useCallback(async (reference: string) => {
    if (!reference) {
      setResult(null);
      return;
    }
    setSearching(true);
    try {
      setResult(await trackByReference(reference));
    } catch {
      setResult(null);
    } finally {
      setSearching(false);
    }
  }, []);

  const [lastSearched, setLastSearched] = React.useState<string | null>(null);
  if (submitted !== lastSearched) {
    setLastSearched(submitted);
    void search(submitted);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(input.trim().toUpperCase());
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {/*
       * A brand band behind the search, so the page has a shape before any
       * result exists. Previously it opened as one small box on a white field
       * and read as unfinished.
       */}
      <header className="brand-gradient text-primary-foreground">
        <div className="mx-auto w-full max-w-3xl px-4 pt-8 pb-16 sm:pt-12 sm:pb-24">
          <div className="mb-6 flex items-center justify-between">
            <Link href="/store">
              <Logo tone="onDark" />
            </Link>
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="text-primary-foreground/90 hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              <Link href="/store">
                <ShoppingBagIcon />
                Shop
              </Link>
            </Button>
          </div>

          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Where is my order?
          </h1>
          <p className="text-primary-foreground/80 mt-2 max-w-md text-sm sm:text-base">
            Enter the tracking number or the order reference we sent you, and we
            will show you exactly where it has reached.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Input
              id="tracking-input"
              value={input}
              onChange={(e) => setInput(e.target.value.toUpperCase())}
              placeholder="AM-2026-0001 or WEB-2026-0007"
              aria-label="Tracking number or order reference"
              className="tabular text-foreground h-13 border-transparent bg-white text-base shadow-sm placeholder:text-neutral-400 dark:bg-neutral-900 dark:text-neutral-50"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              enterKeyHint="search"
            />
            <Button
              type="submit"
              size="lg"
              className="bg-gold-500 hover:bg-gold-600 h-13 shrink-0 px-8 text-neutral-900"
              disabled={!input.trim()}
            >
              <SearchIcon />
              Track
            </Button>
          </form>
        </div>
      </header>

      {/* Content sits on a card that laps over the band, so the page reads as
          one composition rather than a header with a gap beneath it. */}
      <main className="mx-auto -mt-10 w-full max-w-3xl flex-1 px-4 pb-12 sm:-mt-16">
        {!hydrated || !submitted ? (
          <BeforeSearch pickup={pickup} />
        ) : searching ? (
          <Searching />
        ) : !result ? (
          <NotFound />
        ) : (
          <Result result={result} pickup={pickup} />
        )}
      </main>

      <footer className="border-t">
        <div className="text-muted-foreground mx-auto w-full max-w-3xl px-4 py-6 text-center text-xs">
          {[
            pickup.companyName,
            pickup.address,
            pickup.whatsapp && `Call or WhatsApp ${pickup.whatsapp}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </div>
      </footer>
    </div>
  );
}

/**
 * What fills the page before anyone has searched.
 *
 * The old version showed nothing here, which is what made the page feel empty.
 * Explaining the four steps is also the answer to the question most customers
 * are really asking when they check.
 */
function BeforeSearch({ pickup }: { pickup: PublicPickupDetails }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="pt-6">
        <h2 className="text-sm font-semibold">How your order reaches you</h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-2">
          {[
            ["We confirm", "We check your order and call you with the price."],
            ["We buy it", "We order it from the store and pay for it."],
            [
              "It travels",
              `It comes to ${pickup.city || "our office"}, which usually takes 2–3 weeks.`,
            ],
            ["You collect", "We call you when it reaches our office."],
          ].map(([title, body], i) => (
            <li key={title} className="flex gap-3">
              <span className="bg-brand-700/10 text-brand-700 dark:bg-brand-400/15 dark:text-brand-300 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-medium">{title}</p>
                <p className="text-muted-foreground text-xs">{body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-6 flex flex-wrap items-center gap-2 border-t pt-4">
          <MapPinIcon className="text-muted-foreground size-4" />
          <p className="text-muted-foreground text-xs">
            {pickup.address
              ? `Collect from ${pickup.address}`
              : "Collect from our office"}
          </p>
          {pickup.phone && (
            <Button variant="outline" size="sm" asChild className="ml-auto">
              <a href={`tel:${pickup.phone.replace(/\s/g, "")}`}>
                <PhoneIcon />
                {pickup.phone}
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * The lookup crosses the network now, so there is a moment to fill.
 *
 * Deliberately the same shape as the card that replaces it, so the page does
 * not jump when the answer arrives.
 */
function Searching() {
  return (
    <Card className="shadow-sm">
      <CardContent className="flex items-center justify-center gap-3 py-14">
        <Loader2Icon className="text-muted-foreground size-4 animate-spin" />
        <p className="text-muted-foreground text-sm">Looking that up…</p>
      </CardContent>
    </Card>
  );
}

/**
 * One message for every failure.
 *
 * A reference that does not exist and one that is not even the right shape
 * produce exactly this, with nothing that would let someone tell the two apart
 * and walk the number space.
 */
function NotFound() {
  return (
    <Card data-testid="tracking-not-found" className="shadow-sm">
      <CardContent className="flex flex-col items-center gap-3 pt-8 pb-8 text-center">
        <span className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
          <SearchIcon className="size-5" />
        </span>
        <div>
          <p className="text-base font-medium">We could not find that number.</p>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Check it against the message we sent you — or call us and we will
            look it up for you.
          </p>
        </div>
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
      {/* The answer, given first and given big. */}
      <Card className="shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs">Tracking number</p>
              <p className="tabular text-lg font-semibold">
                {result.trackingNumber}
              </p>
            </div>
            <div className="text-right">
              <p className="text-muted-foreground text-xs">Ordered</p>
              <p className="text-sm font-medium">
                {formatDate(result.placedAt)}
              </p>
            </div>
          </div>

          <div
            className={cn(
              "mt-4 rounded-xl border p-4",
              result.arrivedAtOffice && !result.delivered
                ? "border-success/40 bg-success/10"
                : "bg-muted/40",
            )}
          >
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-full",
                  result.arrivedAtOffice && !result.delivered
                    ? "bg-success/15 text-success"
                    : "bg-brand-700/10 text-brand-700 dark:bg-brand-400/15 dark:text-brand-300",
                )}
              >
                {result.arrivedAtOffice ? (
                  <PackageCheckIcon className="size-5" />
                ) : (
                  <ClockIcon className="size-5" />
                )}
              </span>
              <div className="min-w-0">
                <p
                  className="text-xl font-semibold sm:text-2xl"
                  data-testid="tracking-status"
                >
                  {result.statusLabel}
                </p>
                <p className="text-muted-foreground mt-0.5 text-sm">
                  {result.statusMessage}
                </p>
                {result.delivered && result.deliveredAt && (
                  <p className="text-muted-foreground mt-1 text-xs">
                    Handed over on {formatDate(result.deliveredAt)}.
                  </p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress — horizontal on a wide screen, vertical on a phone. */}
      {result.progressIndex !== null && (
        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <h2 className="mb-5 text-sm font-semibold">Progress</h2>

            {/* Wide: a rail across the top, which reads at a glance. */}
            <ol
              className="hidden sm:flex sm:items-start"
              data-testid="tracking-progress"
            >
              {CLIENT_PROGRESS_STAGES.map((stage, index) => {
                const reached = index <= (result.progressIndex ?? -1);
                const current = index === result.progressIndex;
                const last = index === CLIENT_PROGRESS_STAGES.length - 1;
                return (
                  <li key={stage.key} className="flex flex-1 flex-col gap-2">
                    <div className="flex items-center">
                      <span
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                          reached
                            ? "border-brand-600 bg-brand-600 text-primary-foreground"
                            : "border-muted-foreground/25 text-muted-foreground/50",
                          current && "ring-brand-600/25 ring-4",
                        )}
                      >
                        {reached ? <CheckIcon className="size-4" /> : index + 1}
                      </span>
                      {!last && (
                        <span
                          className={cn(
                            "h-0.5 flex-1",
                            index < (result.progressIndex ?? -1)
                              ? "bg-brand-600"
                              : "bg-muted-foreground/20",
                          )}
                        />
                      )}
                    </div>
                    <p
                      className={cn(
                        "pr-3 text-xs",
                        current
                          ? "font-semibold"
                          : reached
                            ? "font-medium"
                            : "text-muted-foreground",
                      )}
                    >
                      {stage.label}
                    </p>
                  </li>
                );
              })}
            </ol>

            {/* Narrow: the same thing stacked, where a rail would not fit. */}
            <ol className="flex flex-col sm:hidden">
              {CLIENT_PROGRESS_STAGES.map((stage, index) => {
                const reached = index <= (result.progressIndex ?? -1);
                const current = index === result.progressIndex;
                const last = index === CLIENT_PROGRESS_STAGES.length - 1;
                return (
                  <li key={stage.key} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-semibold",
                          reached
                            ? "border-brand-600 bg-brand-600 text-primary-foreground"
                            : "border-muted-foreground/25 text-muted-foreground/50",
                          current && "ring-brand-600/25 ring-4",
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

      {/* What they ordered, with the photo big enough to recognise. */}
      <Card className="shadow-sm">
        <CardContent className="pt-6">
          <h2 className="mb-3 text-sm font-semibold">
            {result.items.length > 1 ? "Your products" : "Your product"}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {result.items.map((item, index) => (
              <li
                key={index}
                className="bg-muted/30 flex items-center gap-3 rounded-lg border p-3"
              >
                <ProductThumb
                  size="md"
                  category="other"
                  name={item.name}
                  imageUrl={item.imageUrl}
                />
                <div className="flex min-w-0 flex-col">
                  <span className="line-clamp-2 text-sm font-medium">
                    {item.name}
                  </span>
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
        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <h2 className="mb-3 text-sm font-semibold">
              {result.delivered ? "Collected from" : "Where to collect it"}
            </h2>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <MapPinIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium">{pickup.companyName}</p>
                  {pickup.address && (
                    <p className="text-muted-foreground">{pickup.address}</p>
                  )}
                </div>
              </div>
              {pickup.phone && (
                <Button variant="outline" size="sm" asChild>
                  <a href={`tel:${pickup.phone.replace(/\s/g, "")}`}>
                    <PhoneIcon />
                    {pickup.phone}
                  </a>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* The history, newest first. */}
      {result.timeline.length > 0 && (
        <Card className="shadow-sm">
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
    </div>
  );
}
