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
import { Money, MoneyUsd } from "@/components/shared/money";
import {
  createPurchase,
  useCompany,
  useOrderRows,
  usePaymentMethods,
  useStores,
  type OrderRow,
} from "@/lib/api";
import type { PurchaseStatus } from "@/lib/types";

/**
 * Records what we actually paid a store. Costs are entered in USD — the way the
 * receipt reads — and converted with the FX rate in force on the day.
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
            What we paid the store, in USD, plus the rate we bought dollars at.
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
  const company = useCompany();

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
  const initialItemsCost =
    initialOrder?.order.items
      .filter((i) => i.storeId === initialStore)
      .reduce((sum, i) => sum + i.unitCostUsd * i.qty, 0) ?? 0;

  const [orderId, setOrderId] = React.useState(initialOrder?.order.id ?? "");
  const [storeId, setStoreId] = React.useState(initialStore);
  const [externalOrderNumber, setExternalOrderNumber] = React.useState("");
  const [itemsCost, setItemsCost] = React.useState(
    initialItemsCost ? initialItemsCost.toFixed(2) : "",
  );
  const [tax, setTax] = React.useState("0");
  const [domesticShipping, setDomesticShipping] = React.useState("0");
  const [otherCost, setOtherCost] = React.useState("0");
  const [fxRate, setFxRate] = React.useState(String(company.referenceFxRate));
  const [methodId, setMethodId] = React.useState(methods[0]?.id ?? "pm-visa");
  const [status, setStatus] = React.useState<PurchaseStatus>("placed");
  const [saving, setSaving] = React.useState(false);

  const activeOrder = order ?? allRows.find((r) => r.order.id === orderId);

  const num = (value: string) => Number(value) || 0;
  const totalUsd =
    num(itemsCost) + num(tax) + num(domesticShipping) + num(otherCost);
  const totalAfn = Math.round(totalUsd * num(fxRate));

  const invalid =
    !activeOrder ||
    !storeId ||
    !externalOrderNumber.trim() ||
    num(itemsCost) <= 0 ||
    num(fxRate) <= 0;

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
        itemsCostUsd: num(itemsCost),
        taxUsd: num(tax),
        domesticShippingUsd: num(domesticShipping),
        otherCostUsd: num(otherCost),
        fxRate: num(fxRate),
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

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MoneyField label="Items ($)" value={itemsCost} onChange={setItemsCost} />
          <MoneyField label="Tax ($)" value={tax} onChange={setTax} />
          <MoneyField
            label="Shipping ($)"
            value={domesticShipping}
            onChange={setDomesticShipping}
          />
          <MoneyField label="Other ($)" value={otherCost} onChange={setOtherCost} />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="grid gap-2">
            <Label htmlFor="purchase-fx">FX (AFN/USD)</Label>
            <Input
              id="purchase-fx"
              inputMode="decimal"
              value={fxRate}
              onChange={(e) => setFxRate(e.target.value.replace(/[^\d.]/g, ""))}
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
          <span className="text-muted-foreground">Total cost</span>
          <span className="flex items-center gap-3">
            <MoneyUsd value={totalUsd} className="text-muted-foreground" />
            <Money value={totalAfn} className="font-semibold" />
          </span>
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

function MoneyField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = React.useId();
  return (
    <div className="grid gap-2">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))}
        placeholder="0.00"
        className="tabular"
      />
    </div>
  );
}
