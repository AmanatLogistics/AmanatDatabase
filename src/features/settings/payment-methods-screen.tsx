"use client";

import * as React from "react";
import { toast } from "sonner";
import { PlusIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Money } from "@/components/shared/money";
import {
  upsertPaymentMethod,
  useExpenseRows,
  usePaymentMethods,
  usePaymentRows,
} from "@/lib/api";
import { PAYMENT_METHOD_KIND_LABEL } from "@/lib/constants";
import type { PaymentMethod, PaymentMethodKind } from "@/lib/types";

const USE_LABEL: Record<PaymentMethod["usedFor"], string> = {
  incoming: "Money in",
  outgoing: "Money out",
  both: "Both ways",
};

export function PaymentMethodsSettingsScreen() {
  const methods = usePaymentMethods();
  const payments = usePaymentRows();
  const expenses = useExpenseRows();

  const [editing, setEditing] = React.useState<PaymentMethod | null>(null);
  const [creating, setCreating] = React.useState(false);

  const volume = React.useMemo(() => {
    const map = new Map<string, number>();
    payments.forEach((row) =>
      map.set(
        row.payment.methodId,
        (map.get(row.payment.methodId) ?? 0) + row.payment.amountAfn,
      ),
    );
    expenses.forEach((row) =>
      map.set(
        row.expense.methodId,
        (map.get(row.expense.methodId) ?? 0) + row.expense.amountAfn,
      ),
    );
    return map;
  }, [payments, expenses]);

  async function toggleActive(method: PaymentMethod, active: boolean) {
    await upsertPaymentMethod({ ...method, active });
    toast.success(`${method.name} ${active ? "enabled" : "disabled"}`);
  }

  return (
    <>
      <Card className="overflow-hidden py-0">
        <CardHeader className="px-5 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm">Payment methods</CardTitle>
              <p className="text-muted-foreground text-xs">
                How clients pay us and how we pay the stores.
              </p>
            </div>
            <Button size="sm" onClick={() => setCreating(true)}>
              <PlusIcon />
              Add method
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-0 pt-3 pb-0">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead>Method</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Used for</TableHead>
                <TableHead className="text-right">Volume</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {methods.map((method) => (
                <TableRow key={method.id}>
                  <TableCell>
                    <p className="text-[13px] font-medium">{method.name}</p>
                    {method.accountRef && (
                      <p className="text-muted-foreground tabular text-xs">
                        {method.accountRef}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-[13px]">
                    {PAYMENT_METHOD_KIND_LABEL[method.kind]}
                  </TableCell>
                  <TableCell>
                    <Badge variant="muted">{USE_LABEL[method.usedFor]}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Money
                      value={volume.get(method.id) ?? 0}
                      className="text-[13px]"
                    />
                  </TableCell>
                  <TableCell>
                    <Badge variant={method.active ? "success" : "muted"}>
                      {method.active ? "Active" : "Disabled"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Switch
                        checked={method.active}
                        onCheckedChange={(checked) => toggleActive(method, checked)}
                        aria-label={`Toggle ${method.name}`}
                      />
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => setEditing(method)}
                      >
                        Edit
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <MethodDialog
        open={creating || !!editing}
        method={editing}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false);
            setEditing(null);
          }
        }}
      />
    </>
  );
}

function MethodDialog({
  open,
  method,
  onOpenChange,
}: {
  open: boolean;
  method: PaymentMethod | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {method ? "Edit payment method" : "Add payment method"}
          </DialogTitle>
          <DialogDescription>
            A cash drawer, bank account, wallet or hawala counter.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <MethodForm method={method} onDone={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function MethodForm({
  method,
  onDone,
}: {
  method: PaymentMethod | null;
  onDone: () => void;
}) {
  const [name, setName] = React.useState(method?.name ?? "");
  const [kind, setKind] = React.useState<PaymentMethodKind>(
    method?.kind ?? "cash",
  );
  const [usedFor, setUsedFor] = React.useState<PaymentMethod["usedFor"]>(
    method?.usedFor ?? "both",
  );
  const [accountRef, setAccountRef] = React.useState(method?.accountRef ?? "");
  const [saving, setSaving] = React.useState(false);

  const invalid = !name.trim();

  async function handleSubmit() {
    if (invalid) return;
    setSaving(true);
    try {
      await upsertPaymentMethod({
        id: method?.id ?? `pm-${name.toLowerCase().replace(/\W+/g, "-")}`,
        name: name.trim(),
        kind,
        usedFor,
        accountRef: accountRef.trim() || undefined,
        active: method?.active ?? true,
      });
      toast.success(method ? "Method updated" : "Method added");
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="method-name">Name</Label>
            <Input
              id="method-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Azizi Bank transfer"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="method-kind">Kind</Label>
              <Select
                value={kind}
                onValueChange={(v) => setKind(v as PaymentMethodKind)}
              >
                <SelectTrigger id="method-kind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_METHOD_KIND_LABEL).map(
                    ([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="method-used">Used for</Label>
              <Select
                value={usedFor}
                onValueChange={(v) =>
                  setUsedFor(v as PaymentMethod["usedFor"])
                }
              >
                <SelectTrigger id="method-used" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="incoming">Money in</SelectItem>
                  <SelectItem value="outgoing">Money out</SelectItem>
                  <SelectItem value="both">Both ways</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="method-ref">Account reference (optional)</Label>
            <Input
              id="method-ref"
              value={accountRef}
              onChange={(e) => setAccountRef(e.target.value)}
              placeholder="0041 8829 3310"
              className="tabular"
            />
          </div>
        </div>

      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={invalid || saving}>
          {saving ? "Saving…" : method ? "Save method" : "Add method"}
        </Button>
      </DialogFooter>
    </>
  );
}
