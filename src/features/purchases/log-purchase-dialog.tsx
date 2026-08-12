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
            One amount in AFN — everything the store charged for this purchase.
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

  return (
    <>
      <div className="grid gap-4">
        {!order && (
          <div className="grid gap-2">
            <Label htmlFor="purchase-order">Order</Label>
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
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label htmlFor="purchase-store">Store</Label>
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
            <Label htmlFor="purchase-external">Store order number</Label>
            <Input
              id="purchase-external"
              value={externalOrderNumber}
              onChange={(e) => setExternalOrderNumber(e.target.value)}
              placeholder="114-3941820-7756208"
              className="tabular"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="grid gap-2">
            <Label htmlFor="purchase-cost">Total cost (AFN)</Label>
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
            <Label htmlFor="purchase-method">Paid with</Label>
            <Select value={methodId} onValueChange={setMethodId}>
              <SelectTrigger id="purchase-method" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {methods.map((method) => (
                  <SelectItem key={method.id} value={method.id}>
                    {method.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="purchase-status">Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as PurchaseStatus)}
            >
              <SelectTrigger id="purchase-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="placed">Placed</SelectItem>
                <SelectItem value="shipped_to_warehouse">To warehouse</SelectItem>
                <SelectItem value="received">Received</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Recorded against this order</span>
          <Money value={totalCostAfn} unit="suffix" className="font-semibold" />
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
