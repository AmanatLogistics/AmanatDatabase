"use client";

import * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { toast } from "sonner";
import { CheckIcon, ExternalLinkIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Money } from "@/components/shared/money";
import { PageHeader } from "@/components/shared/page-header";
import { ProductThumb } from "@/components/shared/product-thumb";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  updatePurchaseStatus,
  usePaymentMethodLookup,
  usePurchase,
} from "@/lib/api";
import {
  PRODUCT_CATEGORY_LABEL,
  PURCHASE_PIPELINE,
  PURCHASE_STATUS,
  PURCHASE_STATUS_DESCRIPTION,
  PURCHASE_TERMINAL,
} from "@/lib/constants";
import { formatDate, hostnameOf } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PurchaseStatus } from "@/lib/types";

export function PurchaseDetailScreen({ purchaseId }: { purchaseId: string }) {
  const row = usePurchase(purchaseId);
  const methodOf = usePaymentMethodLookup();
  const [pending, setPending] = React.useState<PurchaseStatus | null>(null);
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function handleChange() {
    if (!pending) return;
    const next = pending;
    setSaving(true);
    try {
      await updatePurchaseStatus(purchaseId, next, note.trim() || undefined);
      toast.success(`Purchase is now ${PURCHASE_STATUS[next].label.toLowerCase()}`);
      setPending(null);
      setNote("");
    } catch {
      toast.error("Could not change the status. Nothing was saved.");
    } finally {
      setSaving(false);
    }
  }

  if (!row) notFound();

  const { purchase, order, client, store } = row;
  const method = methodOf(purchase.paymentMethodId);
  const coveredItems =
    order?.items.filter((item) => purchase.orderItemIds.includes(item.id)) ??
    [];

  return (
    <>
      <PageHeader
        meta={<StatusBadge kind="purchase" value={purchase.status} />}
        description={
          <>
            Bought from {store?.name ?? "a store"} on{" "}
            {formatDate(purchase.purchasedAt)} by {purchase.purchasedBy}
          </>
        }
        actions={
          order && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/orders/${order.id}`}>
                Open order {order.orderNo}
              </Link>
            </Button>
          )
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-sm">Store order</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Store" value={store?.name ?? "—"} />
                <Field
                  label="Store order number"
                  value={
                    <span className="tabular">
                      {purchase.externalOrderNumber}
                    </span>
                  }
                />
                <Field
                  label="Seller invoice"
                  value={purchase.invoiceRef ?? "—"}
                />
                <Field label="Paid with" value={method?.name ?? "—"} />
                <Field
                  label="Purchased"
                  value={formatDate(purchase.purchasedAt)}
                />
                <Field label="Purchased by" value={purchase.purchasedBy} />
                <Field label="Country" value={store?.country ?? "—"} />
                <Field
                  label="Typical lead time"
                  value={store ? `${store.leadTimeDays} days` : "—"}
                />
              </dl>
              {store && (
                <>
                  <Separator className="my-4" />
                  <a
                    href={store.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary inline-flex items-center gap-1 text-sm hover:underline"
                  >
                    {hostnameOf(store.url)}
                    <ExternalLinkIcon className="size-3" />
                  </a>
                </>
              )}
              {purchase.notes && (
                <>
                  <Separator className="my-4" />
                  <p className="text-sm">{purchase.notes}</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <PurchaseStatusCard
            status={purchase.status}
            onPick={(next) => {
              setNote("");
              setPending(next);
            }}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">What we paid</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="tabular text-2xl font-semibold">
                <Money value={purchase.totalCostAfn} unit="suffix" />
              </p>
              <p className="text-muted-foreground text-xs">
                Everything the store charged for this purchase — goods, tax and
                any local delivery — as a single amount paid out.
              </p>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Order lines covered</span>
                <span className="tabular">{purchase.orderItemIds.length}</span>
              </div>
            </CardContent>
          </Card>

          {client && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">For client</CardTitle>
              </CardHeader>
              <CardContent>
                <Link
                  href={`/clients/${client.id}`}
                  className="font-medium hover:underline"
                >
                  {client.name}
                </Link>
                <p className="text-muted-foreground tabular text-xs">
                  {client.code} · {client.city}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Card className="overflow-hidden py-0">
        <div className="px-4 pt-4 pb-3">
          <CardTitle className="text-sm">Items covered</CardTitle>
          <p className="text-muted-foreground text-xs">
            The order lines this store purchase paid for.
          </p>
        </div>
        {coveredItems.length === 0 ? (
          <p className="text-muted-foreground px-4 pb-4 text-sm">
            No order items are linked to this purchase.
          </p>
        ) : (
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Quoted cost (AFN)</TableHead>
                <TableHead className="text-right">Charged client (AFN)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coveredItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <ProductThumb
                        size="sm"
                        category={item.category}
                        imageUrl={item.imageUrl}
                        name={item.name}
                      />
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium">{item.name}</p>
                        <p className="text-muted-foreground text-xs">
                          {PRODUCT_CATEGORY_LABEL[item.category]}
                          {item.variant ? ` · ${item.variant}` : ""}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="tabular text-right text-[13px]">
                    {item.qty}
                  </TableCell>
                  <TableCell className="text-right">
                    <Money
                      value={item.unitCostAfn * item.qty}
                      className="text-muted-foreground text-[13px]"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Money
                      value={item.unitPriceAfn * item.qty}
                      className="text-[13px]"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPending(null);
            setNote("");
          }
        }}
      >
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>
              Mark as {pending ? PURCHASE_STATUS[pending].label.toLowerCase() : ""}
            </DialogTitle>
            <DialogDescription>
              {pending ? PURCHASE_STATUS_DESCRIPTION[pending] : ""}
              {pending === "received" &&
                " The order moves to Arrived, so the client can see it has reached us."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-1.5">
            <Label htmlFor="purchase-status-note">Note (optional)</Label>
            <Textarea
              id="purchase-status-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Two of the four arrived; the rest is still with the forwarder."
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPending(null);
                setNote("");
              }}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleChange} disabled={saving}>
              {saving ? "Saving…" : "Change status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Where the parcel is, and the one button that moves it on.
 *
 * The pipeline is drawn in full rather than hidden in a dropdown: an operator
 * looking at this page wants to know what has happened as much as what to do
 * next, and four stages fit. Cancelled and refunded are outcomes rather than
 * stages, so they sit below the line.
 */
function PurchaseStatusCard({
  status,
  onPick,
}: {
  status: PurchaseStatus;
  onPick: (next: PurchaseStatus) => void;
}) {
  const index = PURCHASE_PIPELINE.indexOf(status);
  const ended = PURCHASE_TERMINAL.includes(status);
  const next = index >= 0 ? PURCHASE_PIPELINE[index + 1] : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Where it is</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ol className="space-y-2.5">
          {PURCHASE_PIPELINE.map((stage, i) => {
            const done = !ended && i < index;
            const current = !ended && i === index;
            return (
              <li key={stage} className="flex items-start gap-2.5">
                <span
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px]",
                    done && "border-success bg-success text-white",
                    current && "border-brand-600 bg-brand-600 text-white",
                    !done && !current && "text-muted-foreground",
                  )}
                >
                  {done ? <CheckIcon className="size-3" /> : i + 1}
                </span>
                <div className="min-w-0">
                  <p
                    className={cn(
                      "text-[13px] leading-tight",
                      current ? "font-medium" : "text-muted-foreground",
                    )}
                  >
                    {PURCHASE_STATUS[stage].label}
                  </p>
                  {current && (
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {PURCHASE_STATUS_DESCRIPTION[stage]}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        {ended ? (
          <p className="text-muted-foreground border-t pt-3 text-xs">
            {PURCHASE_STATUS_DESCRIPTION[status]} Nothing further to record.
          </p>
        ) : (
          <div className="space-y-2 border-t pt-3">
            {next && (
              <Button
                size="sm"
                className="w-full"
                onClick={() => onPick(next)}
                data-testid="advance-purchase"
              >
                Mark as {PURCHASE_STATUS[next].label.toLowerCase()}
              </Button>
            )}
            <div className="flex flex-wrap gap-2">
              {PURCHASE_PIPELINE.filter((s) => s !== status && s !== next).map(
                (stage) => (
                  <Button
                    key={stage}
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground h-7 px-2 text-xs"
                    onClick={() => onPick(stage)}
                  >
                    {PURCHASE_STATUS[stage].label}
                  </Button>
                ),
              )}
              {PURCHASE_TERMINAL.map((stage) => (
                <Button
                  key={stage}
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive h-7 px-2 text-xs"
                  onClick={() => onPick(stage)}
                >
                  {PURCHASE_STATUS[stage].label}
                </Button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-[13px]">{value}</dd>
    </div>
  );
}
