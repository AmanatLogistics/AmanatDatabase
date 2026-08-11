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
import { Textarea } from "@/components/ui/textarea";
import { Money } from "@/components/shared/money";
import {
  createPayment,
  useOrderRows,
  usePaymentMethods,
  type OrderRow,
} from "@/lib/api";
import type { PaymentType } from "@/lib/types";

/**
 * Records a client payment against an order and updates every balance in the
 * app immediately — the client statement, the orders table and the dashboard
 * "outstanding" KPI all read the same store.
 *
 * The form body is mounted only while the dialog is open, so its state is
 * seeded by `useState` initialisers and reset simply by closing the dialog.
 */
export function RecordPaymentDialog({
  open,
  onOpenChange,
  order,
  clientId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-selected order. When omitted the user picks one. */
  order?: OrderRow;
  /** Restricts the order picker to one client. */
  clientId?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            Money received from a client against an order.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <PaymentForm
            order={order}
            clientId={clientId}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PaymentForm({
  order,
  clientId,
  onDone,
}: {
  order?: OrderRow;
  clientId?: string;
  onDone: () => void;
}) {
  const allRows = useOrderRows();
  const methods = usePaymentMethods().filter(
    (m) => m.active && m.usedFor !== "outgoing",
  );

  const selectableOrders = React.useMemo(
    () =>
      allRows
        .filter((row) => {
          if (clientId && row.order.clientId !== clientId) return false;
          return row.economics.balanceAfn > 0;
        })
        .slice(0, 60),
    [allRows, clientId],
  );

  const initialOrder = order ?? selectableOrders[0];
  const initialBalance = initialOrder?.economics.balanceAfn ?? 0;

  const [orderId, setOrderId] = React.useState(initialOrder?.order.id ?? "");
  const [amount, setAmount] = React.useState(
    initialBalance > 0 ? String(Math.round(initialBalance)) : "",
  );
  const [methodId, setMethodId] = React.useState(methods[0]?.id ?? "pm-cash");
  const [type, setType] = React.useState<PaymentType>(
    initialOrder && initialOrder.economics.paidAfn === 0 ? "advance" : "final",
  );
  const [reference, setReference] = React.useState("");
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const activeOrder = order ?? allRows.find((r) => r.order.id === orderId);

  const balance = activeOrder?.economics.balanceAfn ?? 0;
  const amountNumber = Number(amount) || 0;
  const remainingAfter = balance - amountNumber;
  const invalid =
    !activeOrder || amountNumber <= 0 || amountNumber > balance * 1.5;

  async function handleSubmit() {
    if (!activeOrder || invalid) return;
    setSaving(true);
    try {
      const payment = await createPayment({
        clientId: activeOrder.order.clientId,
        orderId: activeOrder.order.id,
        amountAfn: Math.round(amountNumber),
        methodId,
        type,
        reference: reference.trim() || undefined,
        note: note.trim() || undefined,
      });
      toast.success(`Payment recorded — receipt ${payment.receiptNo}`, {
        description:
          remainingAfter <= 0
            ? `${activeOrder.order.orderNo} is now fully settled.`
            : `${activeOrder.order.orderNo} still has ${Math.round(remainingAfter).toLocaleString()} AFN outstanding.`,
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
            <Label htmlFor="payment-order">Order</Label>
            <Select value={orderId} onValueChange={setOrderId}>
              <SelectTrigger id="payment-order" className="w-full">
                <SelectValue placeholder="Select an order with a balance" />
              </SelectTrigger>
              <SelectContent>
                {selectableOrders.length === 0 ? (
                  <SelectItem value="none" disabled>
                    No orders are awaiting payment
                  </SelectItem>
                ) : (
                  selectableOrders.map((row) => (
                    <SelectItem key={row.order.id} value={row.order.id}>
                      {row.order.orderNo} · {row.client?.name} ·{" "}
                      {Math.round(row.economics.balanceAfn).toLocaleString()} AFN
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        )}

        {activeOrder && (
          <div className="bg-muted/50 flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm">
            <div>
              <p className="font-medium">{activeOrder.order.orderNo}</p>
              <p className="text-muted-foreground text-xs">
                {activeOrder.client?.name}
              </p>
            </div>
            <div className="text-right">
              <p className="text-muted-foreground text-xs">Balance due</p>
              <Money value={balance} className="font-semibold" />
            </div>
          </div>
        )}

        <div className="grid gap-2">
          <Label htmlFor="payment-amount">Amount (AFN)</Label>
          <Input
            id="payment-amount"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
            placeholder="0"
            className="tabular"
          />
          {balance > 0 && (
            <div className="flex gap-1.5">
              {[0.25, 0.5, 1].map((fraction) => (
                <Button
                  key={fraction}
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => setAmount(String(Math.round(balance * fraction)))}
                >
                  {fraction === 1 ? "Full balance" : `${fraction * 100}%`}
                </Button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label htmlFor="payment-method">Method</Label>
            <Select value={methodId} onValueChange={setMethodId}>
              <SelectTrigger id="payment-method" className="w-full">
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
            <Label htmlFor="payment-type">Type</Label>
            <Select
              value={type}
              onValueChange={(value) => setType(value as PaymentType)}
            >
              <SelectTrigger id="payment-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="advance">Advance</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="final">Final</SelectItem>
                <SelectItem value="refund">Refund</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="payment-reference">Reference (optional)</Label>
          <Input
            id="payment-reference"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Bank transaction ID, hawala slip…"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="payment-note">Note (optional)</Label>
          <Textarea
            id="payment-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Anything the team should know."
            rows={2}
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={invalid || saving}>
          {saving ? "Saving…" : "Record payment"}
        </Button>
      </DialogFooter>
    </>
  );
}
