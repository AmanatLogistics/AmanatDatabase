"use client";

import Link from "next/link";
import { CheckCircleIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/** Confirmation. Says what happens next, in the order it happens. */
export function ThanksScreen({ reference }: { reference: string }) {
  return (
    <Card className="mx-auto max-w-lg">
      <CardContent className="flex flex-col items-center gap-4 pt-8 text-center">
        <span className="bg-success/10 text-success flex size-14 items-center justify-center rounded-full">
          <CheckCircleIcon className="size-7" />
        </span>
        <div>
          <h1 className="text-xl font-semibold">Thank you — order received</h1>
          {reference && (
            <p className="text-muted-foreground tabular mt-1 text-sm">
              Reference {reference}
            </p>
          )}
        </div>

        <div className="bg-muted/40 w-full rounded-lg border p-4 text-left text-sm">
          <p className="font-medium">What happens next</p>
          <ol className="text-muted-foreground mt-2 grid gap-1.5">
            <li>1. We check your order and call you to confirm the price.</li>
            <li>2. We buy it and bring it to Kabul.</li>
            <li>
              3. We send you a tracking number — until then, this reference
              works on the tracking page.
            </li>
            <li>4. We call you when it reaches our office to collect.</li>
          </ol>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild variant="outline">
            <Link href="/store">Keep shopping</Link>
          </Button>
          <Button asChild>
            <Link href={reference ? `/track?n=${reference}` : "/track"}>
              Track this order
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
