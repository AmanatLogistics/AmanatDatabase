"use client";

import * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { toast } from "sonner";
import {
  CheckIcon,
  CopyIcon,
  CreditCardIcon,
  ExternalLinkIcon,
  MessageSquarePlusIcon,
  PackagePlusIcon,
  PencilIcon,
  PhoneIcon,
  PrinterIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { Money } from "@/components/shared/money";
import { PageHeader } from "@/components/shared/page-header";
import { ProductThumb } from "@/components/shared/product-thumb";
import { StatusBadge } from "@/components/shared/status-badge";
import { OrderStatusStepper } from "@/components/shared/status-stepper";
import { Timeline } from "@/components/shared/timeline";
import { LogPurchaseDialog } from "@/features/purchases/log-purchase-dialog";
import { RecordPaymentDialog } from "@/features/payments/record-payment-dialog";
import {
  addOrderNote,
  setOrderTrackingNumber,
  updateOrderStatus,
  useClientPayments,
  useOrder,
  useStoreLookup,
} from "@/lib/api";
import {
  ORDER_HOLD,
  ORDER_PIPELINE,
  ORDER_SOURCE_LABEL,
  ORDER_STATUS,
  ORDER_TERMINAL,
  PRODUCT_CATEGORY_LABEL,
} from "@/lib/constants";
import {
  formatDate,
  formatDateTime,
  formatPercent,
  hostnameOf,
} from "@/lib/format";
import type { OrderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function OrderDetailScreen({ orderId }: { orderId: string }) {
  const row = useOrder(orderId);
  const storeOf = useStoreLookup();
  const clientPayments = useClientPayments(row?.order.clientId ?? "");

  const [paymentOpen, setPaymentOpen] = React.useState(false);
  const [purchaseOpen, setPurchaseOpen] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [savingNote, setSavingNote] = React.useState(false);
  /** The status the operator picked, held until they confirm with a note. */
  const [pendingStatus, setPendingStatus] = React.useState<OrderStatus | null>(
    null,
  );
  const [statusNote, setStatusNote] = React.useState("");
  const [savingStatus, setSavingStatus] = React.useState(false);
  const [trackingEditOpen, setTrackingEditOpen] = React.useState(false);
  const [trackingDraft, setTrackingDraft] = React.useState("");
  const [trackingError, setTrackingError] = React.useState<string | null>(null);
  const [savingTracking, setSavingTracking] = React.useState(false);

  if (!row) notFound();

  const { order, client, economics, purchases } = row;
  const orderPayments = clientPayments.filter(
    (p) => p.payment.orderId === order.id,
  );

  async function handleStatusChange() {
    if (!pendingStatus) return;
    const next = pendingStatus;
    setSavingStatus(true);
    try {
      await updateOrderStatus(order.id, next, statusNote.trim() || undefined);
      toast.success(`Status set to ${ORDER_STATUS[next].label}`);
      setPendingStatus(null);
      setStatusNote("");
    } catch {
      toast.error("Could not change the status. Nothing was saved.");
    } finally {
      setSavingStatus(false);
    }
  }

  async function handleTrackingSave() {
    setSavingTracking(true);
    setTrackingError(null);
    try {
      await setOrderTrackingNumber(order.id, trackingDraft);
      toast.success("Tracking number updated");
      setTrackingEditOpen(false);
    } catch (error) {
      // Shown inline rather than as a toast: the operator needs it next to the
      // field they must correct.
      setTrackingError(
        error instanceof Error ? error.message : "Could not save that number.",
      );
    } finally {
      setSavingTracking(false);
    }
  }

  async function handleAddNote() {
    if (!note.trim()) return;
    setSavingNote(true);
    try {
      await addOrderNote(order.id, note.trim());
      setNote("");
      toast.success("Note added to the order timeline");
    } finally {
      setSavingNote(false);
    }
  }

  return (
    <>
      <PageHeader
        meta={
          <>
            <StatusBadge kind="order" value={order.status} />
            <TrackingNumberChip value={order.trackingNumber} />
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => {
                setTrackingDraft(order.trackingNumber);
                setTrackingError(null);
                setTrackingEditOpen(true);
              }}
            >
              <PencilIcon className="size-3.5" />
              Edit
            </Button>
          </>
        }
        description={
          <>
            Requested {formatDate(order.requestedAt)} via{" "}
            {ORDER_SOURCE_LABEL[order.source]} by{" "}
            <Link
              href={`/clients/${order.clientId}`}
              className="text-foreground font-medium hover:underline"
            >
              {client?.name ?? "an unknown client"}
            </Link>
          </>
        }
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Change status
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Move order to</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {ORDER_PIPELINE.map((status) => (
                  <DropdownMenuItem
                    key={status}
                    disabled={status === order.status}
                    onSelect={() => setPendingStatus(status)}
                  >
                    <span
                      className={cn(
                        "size-2 rounded-full",
                        ORDER_STATUS[status].dot,
                      )}
                    />
                    {ORDER_STATUS[status].label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                {ORDER_HOLD.map((status) => (
                  <DropdownMenuItem
                    key={status}
                    disabled={status === order.status}
                    onSelect={() => setPendingStatus(status)}
                  >
                    <span
                      className={cn(
                        "size-2 rounded-full",
                        ORDER_STATUS[status].dot,
                      )}
                    />
                    {ORDER_STATUS[status].label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                {ORDER_TERMINAL.map((status) => (
                  <DropdownMenuItem
                    key={status}
                    variant="destructive"
                    disabled={status === order.status}
                    onSelect={() => setPendingStatus(status)}
                  >
                    {ORDER_STATUS[status].label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="outline" size="sm" asChild>
              <Link href={`/print/invoice/${order.id}`} target="_blank">
                <PrinterIcon />
                Invoice
              </Link>
            </Button>
            <Button size="sm" onClick={() => setPaymentOpen(true)}>
              <CreditCardIcon />
              Record payment
            </Button>
          </>
        }
      />

      <Card className="p-4">
        <OrderStatusStepper status={order.status} />
      </Card>

      <div className="grid items-start gap-4 xl:grid-cols-[1fr_320px]">
        {/* ------------------------------------------------------------- */}
        {/* Main column                                                    */}
        {/* ------------------------------------------------------------- */}
        <div className="min-w-0">
          <Tabs defaultValue="items" className="xl:min-h-[460px]">
            <TabsList>
              <TabsTrigger value="items">
                Items
                <span className="text-muted-foreground text-xs">
                  {order.items.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="purchases">
                Purchases
                <span className="text-muted-foreground text-xs">
                  {purchases.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="payments">
                Payments
                <span className="text-muted-foreground text-xs">
                  {orderPayments.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>

            {/* ---- Items -------------------------------------------- */}
            <TabsContent value="items">
              <Card className="overflow-hidden py-0">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Product</TableHead>
                      <TableHead>Store</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit price (AFN)</TableHead>
                      <TableHead className="text-right">Line total (AFN)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.items.map((item) => {
                      const store = storeOf(item.storeId);
                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="flex items-start gap-3">
                              <ProductThumb
                                category={item.category}
                                imageUrl={item.imageUrl}
                                name={item.name}
                              />
                              <div className="min-w-0 space-y-0.5">
                                <p className="text-[13px] leading-snug font-medium">
                                  {item.name}
                                </p>
                                <p className="text-muted-foreground text-xs">
                                  {PRODUCT_CATEGORY_LABEL[item.category]}
                                  {item.variant ? ` · ${item.variant}` : ""}
                                  {item.weightKg ? ` · ${item.weightKg} kg` : ""}
                                </p>
                                {item.productUrl && (
                                  <a
                                    href={item.productUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-primary inline-flex items-center gap-1 text-xs hover:underline"
                                  >
                                    {hostnameOf(item.productUrl)}
                                    <ExternalLinkIcon className="size-3" />
                                  </a>
                                )}
                                {item.notes && (
                                  <p className="text-muted-foreground text-xs italic">
                                    {item.notes}
                                  </p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-[13px] whitespace-nowrap">
                            {store?.name ?? "—"}
                          </TableCell>
                          <TableCell className="tabular text-right text-[13px]">
                            {item.qty}
                          </TableCell>
                          <TableCell className="text-right">
                            <Money value={item.unitPriceAfn} className="text-[13px]" />
                            <p className="text-muted-foreground text-xs">
                              cost <Money value={item.unitCostAfn} />
                            </p>
                          </TableCell>
                          <TableCell className="text-right">
                            <Money
                              value={item.unitPriceAfn * item.qty}
                              className="text-[13px] font-medium"
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                <div className="bg-muted/25 space-y-1.5 border-t px-4 py-3.5 text-sm">
                  <SummaryLine label="Items subtotal" value={economics.revenue.itemsAfn} />
                  <SummaryLine
                    label="Service fee"
                    value={economics.revenue.serviceFeeAfn}
                  />
                  <SummaryLine label="Shipping charged" value={economics.revenue.shippingAfn} />
                  {economics.revenue.discountAfn > 0 && (
                    <SummaryLine
                      label="Discount"
                      value={-economics.revenue.discountAfn}
                    />
                  )}
                  <Separator className="my-2" />
                  <div className="flex items-center justify-between font-semibold">
                    <span>Order total</span>
                    <Money value={economics.revenue.totalAfn} />
                  </div>
                </div>
              </Card>

              {order.notes && (
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle className="text-sm">Order note</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm">{order.notes}</CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ---- Purchases ---------------------------------------- */}
            <TabsContent value="purchases">
              {purchases.length === 0 ? (
                <Card>
                  <EmptyState
                    icon={PackagePlusIcon}
                    title="Nothing purchased yet"
                    description="Once you buy these items from the store, log the purchase so the cost and margin appear here."
                    action={
                      <Button size="sm" onClick={() => setPurchaseOpen(true)}>
                        <PackagePlusIcon />
                        Log a purchase
                      </Button>
                    }
                  />
                </Card>
              ) : (
                <div className="space-y-3">
                  {purchases.map((purchase) => {
                    const store = storeOf(purchase.storeId);
                    return (
                      <Card key={purchase.id}>
                        <CardHeader>
                          <div className="flex flex-wrap items-center gap-2">
                            <CardTitle className="tabular text-sm">
                              <Link
                                href={`/purchases/${purchase.id}`}
                                className="hover:underline"
                              >
                                {purchase.purchaseNo}
                              </Link>
                            </CardTitle>
                            <StatusBadge kind="purchase" value={purchase.status} />
                          </div>
                          <p className="text-muted-foreground text-xs">
                            {store?.name} · order{" "}
                            <span className="tabular">
                              {purchase.externalOrderNumber}
                            </span>{" "}
                            · {formatDate(purchase.purchasedAt)} by{" "}
                            {purchase.purchasedBy}
                          </p>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                            <span className="text-muted-foreground text-xs">
                              {purchase.orderItemIds.length} order line
                              {purchase.orderItemIds.length === 1 ? "" : "s"}{" "}
                              covered
                            </span>
                            <Money
                              value={purchase.totalCostAfn}
                              unit="suffix"
                              className="font-semibold"
                            />
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPurchaseOpen(true)}
                  >
                    <PackagePlusIcon />
                    Log another purchase
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* ---- Payments ----------------------------------------- */}
            <TabsContent value="payments">
              <Card className="overflow-hidden py-0">
                {orderPayments.length === 0 ? (
                  <EmptyState
                    icon={CreditCardIcon}
                    title="No payments recorded"
                    description="The client has not paid anything against this order yet."
                    action={
                      <Button size="sm" onClick={() => setPaymentOpen(true)}>
                        Record payment
                      </Button>
                    }
                  />
                ) : (
                  <>
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow className="hover:bg-transparent">
                          <TableHead>Receipt</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Amount (AFN)</TableHead>
                          <TableHead />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orderPayments.map(({ payment, method }) => (
                          <TableRow key={payment.id}>
                            <TableCell className="tabular text-[13px] font-medium">
                              {payment.receiptNo}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-[13px]">
                              {formatDate(payment.at)}
                            </TableCell>
                            <TableCell className="text-[13px]">
                              {method?.name ?? "—"}
                            </TableCell>
                            <TableCell>
                              <StatusBadge
                                kind="payment"
                                value={payment.type}
                                withDot={false}
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Money
                                value={payment.amountAfn}
                                className="text-[13px] font-medium"
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon-xs" asChild>
                                <Link
                                  href={`/print/receipt/${payment.id}`}
                                  target="_blank"
                                  aria-label="Print receipt"
                                >
                                  <PrinterIcon />
                                </Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="bg-muted/25 flex items-center justify-between border-t px-4 py-3 text-sm">
                      <span className="text-muted-foreground">
                        Paid {formatPercent(
                          economics.revenue.totalAfn > 0
                            ? (economics.paidAfn / economics.revenue.totalAfn) * 100
                            : 0,
                          0,
                        )}{" "}
                        of the order total
                      </span>
                      <span className="flex items-center gap-4">
                        <span className="text-muted-foreground">
                          Balance{" "}
                          <Money
                            value={economics.balanceAfn}
                            className={cn(
                              "font-semibold",
                              economics.balanceAfn > 0
                                ? "text-destructive"
                                : "text-success",
                            )}
                          />
                        </span>
                      </span>
                    </div>
                  </>
                )}
              </Card>
            </TabsContent>

            {/* ---- Activity ----------------------------------------- */}
            <TabsContent value="activity">
              <Card>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <Textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Add a note — a call with the client, a delay, a promise to pay…"
                      rows={2}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!note.trim() || savingNote}
                      onClick={handleAddNote}
                    >
                      <MessageSquarePlusIcon />
                      {savingNote ? "Adding…" : "Add note"}
                    </Button>
                  </div>
                  <Separator />
                  <Timeline
                    entries={order.timeline
                      .slice()
                      .reverse()
                      .map((event) => ({
                        id: event.id,
                        at: event.at,
                        title: event.title,
                        description: event.description,
                        dot:
                          event.status in ORDER_STATUS
                            ? ORDER_STATUS[event.status as OrderStatus].dot
                            : "bg-muted-foreground",
                        meta: (
                          <span className="text-muted-foreground text-xs">
                            {event.actor}
                          </span>
                        ),
                      }))}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* Right rail                                                     */}
        {/* ------------------------------------------------------------- */}
        <div className="space-y-4 xl:sticky xl:top-20">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-baseline justify-between text-sm">
                Financial summary
                <span className="text-muted-foreground text-[11px] font-normal">
                  AFN
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <SummaryLine label="Revenue" value={economics.revenue.totalAfn} />
              <SummaryLine
                label="Goods cost"
                value={-economics.cost.goodsAfn}
                muted
              />
              <SummaryLine
                label="Freight"
                value={-economics.cost.freightAfn}
                muted
              />
              <SummaryLine
                label="Customs duty"
                value={-economics.cost.customsAfn}
                muted
              />
              <Separator className="my-2" />
              <div className="flex items-center justify-between">
                <span className="font-medium">Profit</span>
                <Money
                  value={economics.profitAfn}
                  tone="signed"
                  className="font-semibold"
                />
              </div>
              <div className="text-muted-foreground flex items-center justify-between text-xs">
                <span>Margin</span>
                <span className="tabular">
                  {formatPercent(economics.marginPercent)}
                </span>
              </div>
              {economics.cost.estimated && (
                <p className="text-muted-foreground/80 text-xs">
                  Cost is projected from the quotation — no purchase logged yet.
                </p>
              )}
              <Separator className="my-2" />
              <SummaryLine label="Paid by client" value={economics.paidAfn} />
              <div className="flex items-center justify-between">
                <span className="font-medium">Balance due</span>
                <Money
                  value={economics.balanceAfn}
                  className={cn(
                    "font-semibold",
                    economics.balanceAfn > 0
                      ? "text-destructive"
                      : "text-success",
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {client && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Client</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Link
                    href={`/clients/${client.id}`}
                    className="font-medium hover:underline"
                  >
                    {client.name}
                  </Link>
                  <p className="text-muted-foreground tabular text-xs">
                    {client.code} · {client.city}
                  </p>
                </div>
                <div className="space-y-1.5 text-sm">
                  <a
                    href={`tel:${client.phone}`}
                    className="text-muted-foreground hover:text-foreground flex items-center gap-2"
                  >
                    <PhoneIcon className="size-3.5" />
                    <span className="tabular">{client.phone}</span>
                  </a>
                  {client.address && (
                    <p className="text-muted-foreground text-xs">
                      {client.address}
                    </p>
                  )}
                </div>
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link href={`/clients/${client.id}`}>Open client file</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Quick actions</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Button
                variant="outline"
                size="sm"
                className="justify-start"
                onClick={() => setPurchaseOpen(true)}
              >
                <PackagePlusIcon />
                Log purchase
              </Button>
              <Button variant="outline" size="sm" className="justify-start" asChild>
                <Link href={`/print/quotation/${order.id}`} target="_blank">
                  <PrinterIcon />
                  Print quotation
                </Link>
              </Button>
            </CardContent>
          </Card>

          <p className="text-muted-foreground px-1 text-xs">
            Last updated{" "}
            {formatDateTime(order.timeline[order.timeline.length - 1]?.at)}
          </p>
        </div>
      </div>

      <Dialog
        open={pendingStatus !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingStatus(null);
            setStatusNote("");
          }
        }}
      >
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>
              Move to {pendingStatus ? ORDER_STATUS[pendingStatus].label : ""}
            </DialogTitle>
            <DialogDescription>
              The change is stamped on the order timeline. Add a note if the
              client or the team will need the reason later.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-1.5">
            <Label htmlFor="status-note">Note (optional)</Label>
            <Textarea
              id="status-note"
              rows={3}
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
              placeholder="Held until the client confirms the colour."
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPendingStatus(null);
                setStatusNote("");
              }}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleStatusChange} disabled={savingStatus}>
              {savingStatus ? "Saving…" : "Change status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={trackingEditOpen} onOpenChange={setTrackingEditOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Edit tracking number</DialogTitle>
            <DialogDescription>
              This is the only number the client can look the order up with.
              Changing it makes any copy they already have stop working.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-1.5">
            <Label htmlFor="tracking-number-input">Tracking number</Label>
            <Input
              id="tracking-number-input"
              value={trackingDraft}
              onChange={(e) => {
                setTrackingDraft(e.target.value.toUpperCase());
                setTrackingError(null);
              }}
              className="tabular"
              aria-invalid={trackingError !== null}
            />
            {trackingError ? (
              <p className="text-destructive text-xs" role="alert">
                {trackingError}
              </p>
            ) : (
              <p className="text-muted-foreground text-xs">
                Format AS-YYYY-XXXXXX. The letters I, L, O and U are not used.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTrackingEditOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleTrackingSave}
              disabled={
                savingTracking ||
                !trackingDraft.trim() ||
                trackingDraft.trim().toUpperCase() === order.trackingNumber
              }
            >
              {savingTracking ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RecordPaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        order={row}
      />
      <LogPurchaseDialog
        open={purchaseOpen}
        onOpenChange={setPurchaseOpen}
        order={row}
      />
    </>
  );
}

/**
 * The number the client quotes on the phone, so it sits beside the status badge
 * rather than inside a tab. Copying it is the common case — staff paste it into
 * WhatsApp — so the whole chip is the copy button.
 */
function TrackingNumberChip({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy the tracking number.");
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      data-testid="tracking-number"
      aria-label={`Copy tracking number ${value}`}
      className="bg-muted/60 text-foreground hover:bg-muted inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors"
    >
      <span className="text-muted-foreground">Tracking</span>
      <span className="tabular">{value}</span>
      {copied ? (
        <CheckIcon className="text-success size-3.5" />
      ) : (
        <CopyIcon className="text-muted-foreground size-3.5" />
      )}
    </button>
  );
}

function SummaryLine({
  label,
  value,
  muted,
}: {
  label: string;
  value: number;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <Money value={value} tone={muted ? "muted" : "plain"} />
    </div>
  );
}

