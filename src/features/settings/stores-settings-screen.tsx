"use client";

import * as React from "react";
import { toast } from "sonner";
import { ExternalLinkIcon, PlusIcon } from "lucide-react";

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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { upsertStore, usePurchaseRows, useStores } from "@/lib/api";
import { hostnameOf } from "@/lib/format";
import type { Store } from "@/lib/types";

export function StoresSettingsScreen() {
  const stores = useStores();
  const purchases = usePurchaseRows();
  const [editing, setEditing] = React.useState<Store | null>(null);
  const [creating, setCreating] = React.useState(false);

  const usageByStore = React.useMemo(() => {
    const map = new Map<string, number>();
    purchases.forEach((row) =>
      map.set(row.purchase.storeId, (map.get(row.purchase.storeId) ?? 0) + 1),
    );
    return map;
  }, [purchases]);

  async function toggleActive(store: Store, active: boolean) {
    await upsertStore({ ...store, active });
    toast.success(`${store.name} ${active ? "enabled" : "disabled"}`);
  }

  return (
    <>
      <Card className="overflow-hidden py-0">
        <CardHeader className="px-5 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm">Stores we buy from</CardTitle>
              <p className="text-muted-foreground text-xs">
                These appear in the order builder and the purchase form.
              </p>
            </div>
            <Button size="sm" onClick={() => setCreating(true)}>
              <PlusIcon />
              Add store
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-0 pt-3 pb-0">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead>Store</TableHead>
                <TableHead>Country</TableHead>
                <TableHead className="text-right">Lead time</TableHead>
                <TableHead className="text-right">Purchases</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {stores.map((store) => (
                <TableRow key={store.id}>
                  <TableCell>
                    <p className="text-[13px] font-medium">{store.name}</p>
                    <a
                      href={store.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted-foreground hover:text-primary inline-flex items-center gap-1 text-xs"
                    >
                      {hostnameOf(store.url)}
                      <ExternalLinkIcon className="size-3" />
                    </a>
                  </TableCell>
                  <TableCell className="text-[13px]">{store.country}</TableCell>
                  <TableCell className="tabular text-right text-[13px]">
                    {store.leadTimeDays} days
                  </TableCell>
                  <TableCell className="tabular text-right text-[13px]">
                    {usageByStore.get(store.id) ?? 0}
                  </TableCell>
                  <TableCell>
                    <Badge variant={store.active ? "success" : "muted"}>
                      {store.active ? "Active" : "Disabled"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Switch
                        checked={store.active}
                        onCheckedChange={(checked) => toggleActive(store, checked)}
                        aria-label={`Toggle ${store.name}`}
                      />
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => setEditing(store)}
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

      <StoreDialog
        open={creating || !!editing}
        store={editing}
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

function StoreDialog({
  open,
  store,
  onOpenChange,
}: {
  open: boolean;
  store: Store | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{store ? "Edit store" : "Add store"}</DialogTitle>
          <DialogDescription>
            Somewhere we buy client products from.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <StoreForm store={store} onDone={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function StoreForm({
  store,
  onDone,
}: {
  store: Store | null;
  onDone: () => void;
}) {
  const [name, setName] = React.useState(store?.name ?? "");
  const [url, setUrl] = React.useState(store?.url ?? "https://");
  const [country, setCountry] = React.useState(store?.country ?? "");
  const [leadTime, setLeadTime] = React.useState(
    String(store?.leadTimeDays ?? 14),
  );
  const [saving, setSaving] = React.useState(false);

  const invalid = !name.trim() || !country.trim();

  async function handleSubmit() {
    if (invalid) return;
    setSaving(true);
    try {
      await upsertStore({
        id: store?.id ?? `store-${name.toLowerCase().replace(/\W+/g, "-")}`,
        name: name.trim(),
        url: url.trim(),
        country: country.trim(),
        leadTimeDays: Number(leadTime) || 14,
        active: store?.active ?? true,
      });
      toast.success(store ? "Store updated" : "Store added");
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="store-name">Name</Label>
            <Input
              id="store-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Amazon UK"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="store-url">Website</Label>
            <Input
              id="store-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.amazon.co.uk"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="store-country">Country</Label>
              <Input
                id="store-country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="United Kingdom"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="store-lead">Lead time (days)</Label>
              <Input
                id="store-lead"
                inputMode="numeric"
                value={leadTime}
                onChange={(e) => setLeadTime(e.target.value.replace(/[^\d]/g, ""))}
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
          {saving ? "Saving…" : store ? "Save store" : "Add store"}
        </Button>
      </DialogFooter>
    </>
  );
}
