"use client";

import * as React from "react";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeftIcon, CheckIcon, PhoneIcon, XIcon } from "lucide-react";

import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { Money } from "@/components/shared/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  convertWebOrder,
  deleteWebOrder,
  dismissWebOrder,
  useWebOrder,
} from "@/lib/api";
import { formatDateTime } from "@/lib/format";

/**
 * One website order, and the decision to make about it.
 *
 * Converting is the only place the two systems meet: it creates the client if
 * they are new, then an ordinary operations order with a tracking number. From
 * that point the shop is out of the picture and the existing status lifecycle
 * takes over.
 */
export function WebOrderDetailScreen({ webOrderId }: { webOrderId: string }) {
  const router = useRouter();
  const order = useWebOrder(webOrderId);
  const [busy, setBusy] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  if (!order) notFound();

  async function handleConvert() {
    if (!order) return;
    setBusy(true);
    try {
      const created = await convertWebOrder(order.id);
      toast.success(`Converted to ${created.orderNo}`, {
        description: `Tracking ${created.trackingNumber} — give this to the customer.`,
      });
      router.push(`/orders/${created.id}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not convert that order.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit">
        <Link href="/shop/orders">
          <ArrowLeftIcon />
          Website orders
        </Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="tabular text-xl font-semibold tracking-tight">
              {order.reference}
            </h1>
            <Badge
              variant={
                order.status === "new"
                  ? "warning"
                  : order.status === "converted"
                    ? "success"
                    : "muted"
              }
            >
              {order.status === "new"
                ? "Needs action"
                : order.status === "converted"
                  ? "Converted"
                  : "Dismissed"}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            Placed {formatDateTime(order.placedAt)}
          </p>
        </div>

        {order.status === "new" && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleConvert} disabled={busy}>
              <CheckIcon />
              {busy ? "Converting…" : "Convert to order"}
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                void dismissWebOrder(order.id).then(() =>
                  toast.success(`${order.reference} dismissed`),
                )
              }
            >
              <XIcon />
              Dismiss
            </Button>
          </div>
        )}
      </div>

      {order.status === "converted" && order.convertedOrderId && (
        <Card className="border-success/40 bg-success/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
            <div>
              <p className="text-sm font-medium">
                This is now a real order in operations.
              </p>
              <p className="text-muted-foreground tabular text-xs">
                Tracking {order.trackingNumber}
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/orders/${order.convertedOrderId}`}>
                Open the order
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardContent className="pt-6">
            <h2 className="mb-3 text-sm font-semibold">What they ordered</h2>
            <ul className="divide-y">
              {order.lines.map((line) => (
                <li
                  key={line.productId}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{line.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {line.qty} × <Money value={line.priceAfn} unit="suffix" />
                    </p>
                  </div>
                  <Money value={line.priceAfn * line.qty} />
                </li>
              ))}
            </ul>
            <Separator className="my-3" />
            <div className="flex items-center justify-between font-semibold">
              <span>Total the customer agreed to</span>
              <Money value={order.totalAfn} unit="suffix" />
            </div>
            {order.note && (
              <p className="text-muted-foreground mt-3 text-sm italic">
                “{order.note}”
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <h2 className="mb-3 text-sm font-semibold">Customer</h2>
            <dl className="grid gap-2.5 text-sm">
              <div>
                <dt className="text-muted-foreground text-xs">Name</dt>
                <dd className="font-medium">{order.customerName}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Phone</dt>
                <dd className="tabular">{order.customerPhone}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">City</dt>
                <dd>{order.customerCity}</dd>
              </div>
              {order.customerAddress && (
                <div>
                  <dt className="text-muted-foreground text-xs">Address</dt>
                  <dd>{order.customerAddress}</dd>
                </div>
              )}
            </dl>
            <Button variant="outline" size="sm" asChild className="mt-3 w-full">
              <a href={`tel:${order.customerPhone.replace(/\s/g, "")}`}>
                <PhoneIcon />
                Call them
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>

      {order.status !== "new" && (
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive w-fit"
          onClick={() => setDeleting(true)}
        >
          Delete this record
        </Button>
      )}

      {deleting && (
        <ConfirmDeleteDialog
          open
          onOpenChange={setDeleting}
          title="Delete this website order?"
          subject={order.reference}
          consequences={
            order.convertedOrderId
              ? ["The operations order it created stays — only this record goes"]
              : []
          }
          confirmLabel="Delete record"
          successMessage={`${order.reference} deleted`}
          onConfirm={async () => {
            await deleteWebOrder(order.id);
            router.push("/shop/orders");
          }}
        />
      )}
    </>
  );
}
