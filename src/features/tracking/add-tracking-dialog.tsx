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
import { createShipment, useOrderRows, useToday, type OrderRow } from "@/lib/api";
import { CARRIERS } from "@/lib/constants";

const ORIGINS = [
  "Dubai, UAE",
  "Memphis, USA",
  "Guangzhou, China",
  "Peshawar, Pakistan",
  "Istanbul, Türkiye",
];

export function AddTrackingDialog({
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
          <DialogTitle>Add tracking</DialogTitle>
          <DialogDescription>
            Book the shipment against an order so the client can be told where it is.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <TrackingForm order={order} onDone={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function TrackingForm({
  order,
  onDone,
}: {
  order?: OrderRow;
  onDone: () => void;
}) {
  const allRows = useOrderRows();
  const today = useToday();

  const shippableOrders = React.useMemo(
    () =>
      allRows.filter(
        (row) =>
          !row.shipment &&
          ["confirmed", "purchasing", "purchased"].includes(row.order.status),
      ),
    [allRows],
  );

  const initialOrder = order ?? shippableOrders[0];
  const initialWeight =
    initialOrder?.order.items.reduce((sum, i) => sum + (i.weightKg ?? 0.5), 0) ?? 0;

  const [orderId, setOrderId] = React.useState(initialOrder?.order.id ?? "");
  const [carrier, setCarrier] = React.useState<string>(CARRIERS[0]);
  const [trackingNumber, setTrackingNumber] = React.useState("");
  const [origin, setOrigin] = React.useState(ORIGINS[0]);
  const [weightKg, setWeightKg] = React.useState(
    initialWeight ? initialWeight.toFixed(2) : "",
  );
  const [freight, setFreight] = React.useState(
    String(Math.max(280, Math.round(initialWeight * 90))),
  );
  const [customs, setCustoms] = React.useState("0");
  const [etaDays, setEtaDays] = React.useState("10");
  const [saving, setSaving] = React.useState(false);

  const activeOrder = order ?? allRows.find((r) => r.order.id === orderId);
  const invalid = !activeOrder || !trackingNumber.trim() || !carrier;

  async function handleSubmit() {
    if (!activeOrder || invalid) return;
    setSaving(true);
    try {
      const etaAt = new Date(
        today.getTime() + (Number(etaDays) || 10) * 86_400_000,
      ).toISOString();

      await createShipment({
        orderId: activeOrder.order.id,
        carrier,
        trackingNumber: trackingNumber.trim(),
        origin,
        destination: "Kabul, Afghanistan",
        etaAt,
        weightKg: Number(weightKg) || 0,
        freightCostAfn: Number(freight) || 0,
        customsDutyAfn: Number(customs) || 0,
      });
      toast.success("Tracking added", {
        description: `${activeOrder.order.orderNo} is now in transit with ${carrier}.`,
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
            <Label htmlFor="tracking-order">Order</Label>
            <Select value={orderId} onValueChange={setOrderId}>
              <SelectTrigger id="tracking-order" className="w-full">
                <SelectValue placeholder="Select an order" />
              </SelectTrigger>
              <SelectContent>
                {shippableOrders.length === 0 ? (
                  <SelectItem value="none" disabled>
                    No purchased orders are waiting for a shipment
                  </SelectItem>
                ) : (
                  shippableOrders.map((row) => (
                    <SelectItem key={row.order.id} value={row.order.id}>
                      {row.order.orderNo} · {row.client?.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label htmlFor="tracking-carrier">Carrier</Label>
            <Select value={carrier} onValueChange={setCarrier}>
              <SelectTrigger id="tracking-carrier" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CARRIERS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tracking-number">Tracking number</Label>
            <Input
              id="tracking-number"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="7412885930"
              className="tabular"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label htmlFor="tracking-origin">Origin</Label>
            <Select value={origin} onValueChange={setOrigin}>
              <SelectTrigger id="tracking-origin" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORIGINS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tracking-eta">ETA (days from today)</Label>
            <Input
              id="tracking-eta"
              inputMode="numeric"
              value={etaDays}
              onChange={(e) => setEtaDays(e.target.value.replace(/[^\d]/g, ""))}
              className="tabular"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="grid gap-2">
            <Label htmlFor="tracking-weight" className="text-xs">
              Weight (kg)
            </Label>
            <Input
              id="tracking-weight"
              inputMode="decimal"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value.replace(/[^\d.]/g, ""))}
              className="tabular"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tracking-freight" className="text-xs">
              Freight (AFN)
            </Label>
            <Input
              id="tracking-freight"
              inputMode="numeric"
              value={freight}
              onChange={(e) => setFreight(e.target.value.replace(/[^\d]/g, ""))}
              className="tabular"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tracking-customs" className="text-xs">
              Duty (AFN)
            </Label>
            <Input
              id="tracking-customs"
              inputMode="numeric"
              value={customs}
              onChange={(e) => setCustoms(e.target.value.replace(/[^\d]/g, ""))}
              className="tabular"
            />
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={invalid || saving}>
          {saving ? "Saving…" : "Add tracking"}
        </Button>
      </DialogFooter>
    </>
  );
}
