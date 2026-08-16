"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Money } from "@/components/shared/money";
import {
  createPurchase,
  useOrderRows,
  usePaymentMethods,
  useStores,
  type OrderRow,
} from "@/lib/api";
import {
  PAYMENT_METHOD_KIND_LABEL,
  PURCHASE_STATUS,
  PURCHASE_STATUS_DESCRIPTION,
} from "@/lib/constants";
import type { PurchaseStatus } from "@/lib/types";

/**
 * Records what we actually paid a store, as one amount in Afghani. The business
 * runs a single currency, so there is nothing to convert and nothing to reconcile
 * — the operator types what left the till.
 */
export function LogPurchaseDialog({
  open,
  onOpenChange,
  order,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order?: OrderRow;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Log a purchase</DialogTitle>
          <DialogDescription>
            Record money we paid a store for a customer&apos;s order. This is
            our cost, not what the client pays us.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <PurchaseForm order={order} onDone={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PurchaseForm({
  order,
  onDone,
}: {
  order?: OrderRow;
  onDone: () => void;
}) {
  const allRows = useOrderRows();
  const stores = useStores().filter((s) => s.active);
  const methods = usePaymentMethods().filter(
    (m) => m.active && m.usedFor !== "incoming",
  );
  const purchasableOrders = React.useMemo(
    () =>
      allRows
        .filter((row) =>
          ["requested", "quoted", "confirmed", "purchasing", "purchased"].includes(
            row.order.status,
          ),
        )
        .slice(0, 60),
    [allRows],
  );

  const initialOrder = order ?? purchasableOrders[0];
  const initialStore =
    initialOrder?.order.items[0]?.storeId ?? stores[0]?.id ?? "";
  /* Pre-fill with the estimate we quoted from, so the operator only corrects it. */
  const initialCost =
    initialOrder?.order.items
      .filter((i) => i.storeId === initialStore)
      .reduce((sum, i) => sum + i.unitCostAfn * i.qty, 0) ?? 0;

  const [orderId, setOrderId] = React.useState(initialOrder?.order.id ?? "");
  const [storeId, setStoreId] = React.useState(initialStore);
  const [externalOrderNumber, setExternalOrderNumber] = React.useState("");
  const [cost, setCost] = React.useState(
    initialCost ? String(Math.round(initialCost)) : "",
  );
  const [methodId, setMethodId] = React.useState(methods[0]?.id ?? "pm-visa");
  const [status, setStatus] = React.useState<PurchaseStatus>("placed");
  const [saving, setSaving] = React.useState(false);

  const activeOrder = order ?? allRows.find((r) => r.order.id === orderId);

  const num = (value: string) => Number(value) || 0;
  const totalCostAfn = Math.round(num(cost));

  const invalid =
    !activeOrder ||
    !storeId ||
    !externalOrderNumber.trim() ||
    totalCostAfn <= 0;

  async function handleSubmit() {
    if (!activeOrder || invalid) return;
    setSaving(true);
    try {
      const purchase = await createPurchase({
        orderId: activeOrder.order.id,
        orderItemIds: activeOrder.order.items
          .filter((i) => i.storeId === storeId)
          .map((i) => i.id),
        storeId,
        externalOrderNumber: externalOrderNumber.trim(),
        paymentMethodId: methodId,
        totalCostAfn,
        status,
      });
      toast.success(`Purchase ${purchase.purchaseNo} logged`, {
        description: `${activeOrder.order.orderNo} cost updated — margin recalculated.`,
      });
      onDone();
    } finally {
      setSaving(false);
    }
  }

  const clientPaysAfn = activeOrder?.economics.revenue.totalAfn ?? 0;
  const alreadySpentAfn = activeOrder?.purchases
    .filter((p) => p.status !== "cancelled")
    .reduce((sum, p) => sum + p.totalCostAfn, 0);
  const coveredItems =
    activeOrder?.order.items.filter((i) => i.storeId === storeId) ?? [];

  return (
    <>
      <div className="grid max-h-[65vh] gap-5 overflow-y-auto pr-1">
        {/* 1 — what is this purchase for? --------------------------------- */}
        <Section
          step={1}
          title="Which customer order is this for?"
          hint="A purchase always belongs to one order. This is how the cost reaches that order's margin."
        >
          {!order ? (
            <div className="grid gap-2">
              <Label htmlFor="purchase-order">Customer order</Label>
              <Select value={orderId} onValueChange={setOrderId}>
                <SelectTrigger id="purchase-order" className="w-full">
                  <SelectValue placeholder="Select an order" />
                </SelectTrigger>
                <SelectContent>
                  {purchasableOrders.map((row) => (
                    <SelectItem key={row.order.id} value={row.order.id}>
                      {row.order.orderNo} · {row.client?.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <p className="text-sm">
              <span className="font-medium">{order.order.orderNo}</span>
              {order.client ? ` · ${order.client.name}` : ""}
            </p>
          )}

          {activeOrder && (
            <div className="bg-muted/40 mt-1 rounded-lg border p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  The client pays us for this order
                </span>
                <Money value={clientPaysAfn} unit="suffix" className="font-medium" />
              </div>
              <p className="text-muted-foreground mt-1.5">
                That is money coming <span className="font-medium">in</span>. It
                is not what you enter below.
              </p>
            </div>
          )}
        </Section>

        {/* 2 — where did we buy it? --------------------------------------- */}
        <Section
          step={2}
          title="Where did you buy it?"
          hint="The shop or platform the goods came from, and their own order number so you can find it again."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="purchase-store">Store or platform</Label>
              <Select value={storeId} onValueChange={setStoreId}>
                <SelectTrigger id="purchase-store" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="purchase-external">
                The store&apos;s own order number
              </Label>
              <Input
                id="purchase-external"
                value={externalOrderNumber}
                onChange={(e) => setExternalOrderNumber(e.target.value)}
                placeholder="114-3941820-7756208"
                className="tabular"
              />
              <p className="text-muted-foreground text-xs">
                From your Amazon or Daraz receipt — not our tracking number.
              </p>
            </div>
          </div>
          {coveredItems.length > 0 && (
            <p className="text-muted-foreground text-xs">
              Covers {coveredItems.length} item
              {coveredItems.length > 1 ? "s" : ""} on this order:{" "}
              {coveredItems.map((i) => i.name).join(", ")}
            </p>
          )}
        </Section>

        {/* 3 — what did we pay, and out of which account? ----------------- */}
        <Section
          step={3}
          title="What did we pay the store?"
          hint="Money going out of our pocket. Enter what the store actually charged, including their delivery — not what the client pays us."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="purchase-cost">Amount we paid (AFN)</Label>
              <Input
                id="purchase-cost"
                inputMode="numeric"
                value={cost}
                onChange={(e) => setCost(e.target.value.replace(/[^\d]/g, ""))}
                placeholder="0"
                className="tabular"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="purchase-method">Paid from which account?</Label>
              <Select value={methodId} onValueChange={setMethodId}>
                <SelectTrigger id="purchase-method" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {methods.map((method) => (
                    <SelectItem key={method.id} value={method.id}>
                      {method.name} · {PAYMENT_METHOD_KIND_LABEL[method.kind]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                The card, cash or hawala the money left from.
              </p>
            </div>
          </div>
        </Section>

        {/* 4 — where is it now? ------------------------------------------- */}
        <Section
          step={4}
          title="Where is it now?"
          hint="This tracks the goods between the store and us. It is separate from the customer order's own status."
        >
          <div className="grid gap-2">
            <Label htmlFor="purchase-status">Purchase stage</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as PurchaseStatus)}
            >
              <SelectTrigger id="purchase-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(
                  [
                    "pending",
                    "placed",
                    "shipped_to_warehouse",
                    "received",
                  ] as PurchaseStatus[]
                ).map((value) => (
                  <SelectItem key={value} value={value}>
                    {PURCHASE_STATUS[value].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              {PURCHASE_STATUS_DESCRIPTION[status]}
            </p>
          </div>
        </Section>

        <Separator />

        {/* The two amounts, side by side, so they cannot be confused. ----- */}
        <div className="grid gap-1.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">
              Client pays us (money in)
            </span>
            <Money value={clientPaysAfn} unit="suffix" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">
              We pay the store (money out)
            </span>
            <Money
              value={-totalCostAfn}
              unit="suffix"
              className="text-destructive"
            />
          </div>
          {alreadySpentAfn ? (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                Already spent on this order
              </span>
              <Money value={-alreadySpentAfn} unit="suffix" tone="muted" />
            </div>
          ) : null}
          <Separator className="my-1" />
          <div className="flex items-center justify-between font-semibold">
            <span>Left over on this order</span>
            <Money
              value={clientPaysAfn - totalCostAfn - (alreadySpentAfn ?? 0)}
              unit="suffix"
              tone="signed"
            />
          </div>
          <p className="text-muted-foreground text-xs">
            Before freight and duty, which are recorded on the order itself.
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={invalid || saving}>
          {saving ? "Saving…" : "Log purchase"}
        </Button>
      </DialogFooter>
    </>
  );
}

/** A numbered step, so the dialog reads as a sequence rather than a form dump. */
function Section({
  step,
  title,
  hint,
  children,
}: {
  step: number;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-2.5">
      <div className="flex items-start gap-2.5">
        <span className="bg-brand-700/10 text-brand-700 dark:bg-brand-400/15 dark:text-brand-300 mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold">
          {step}
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-medium">{title}</h3>
          <p className="text-muted-foreground text-xs">{hint}</p>
        </div>
      </div>
      <div className="grid gap-3 pl-7.5">{children}</div>
    </section>
  );
}
