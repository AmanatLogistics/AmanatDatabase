"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PlusIcon, RefreshCwIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { Money } from "@/components/shared/money";
import { PageHeader } from "@/components/shared/page-header";
import { ProductThumb } from "@/components/shared/product-thumb";
import {
  createOrder,
  useClients,
  useCompany,
  useStores,
  type CreateOrderItemInput,
} from "@/lib/api";
import { ORDER_SOURCE_LABEL, PRODUCT_CATEGORY_LABEL } from "@/lib/constants";
import { generateTrackingNumber } from "@/lib/tracking";
import type { OrderSource, ProductCategory } from "@/lib/types";

interface DraftItem extends CreateOrderItemInput {
  key: string;
}

/**
 * `key` is only ever used as a React list key and a lookup handle — it never
 * reaches the DOM. Field ids come from `useId()` inside `<ItemFields>`, which is
 * hydration-stable; deriving ids from a counter or `Math.random()` here would
 * make the server and client markup disagree.
 */
let itemKeySeq = 0;

function emptyItem(storeId: string): DraftItem {
  itemKeySeq += 1;
  return {
    key: `item-${itemKeySeq}`,
    name: "",
    productUrl: "",
    storeId,
    category: "other",
    variant: "",
    qty: 1,
    unitPriceAfn: 0,
    unitCostAfn: 0,
    weightKg: 0,
  };
}

export function NewOrderScreen() {
  const router = useRouter();
  const clients = useClients();
  const stores = useStores().filter((s) => s.active);
  const company = useCompany();

  const [clientId, setClientId] = React.useState("");
  const [source, setSource] = React.useState<OrderSource>("whatsapp");
  const [items, setItems] = React.useState<DraftItem[]>(() => [
    emptyItem(stores[0]?.id ?? "store-amazon-us"),
  ]);
  const [serviceFee, setServiceFee] = React.useState("");
  /*
   * Empty, not 400.
   *
   * A number already in the box is a number that gets sent: it read as the
   * delivery charge rather than as a suggestion, and orders went out carrying
   * it whether or not anybody had decided to charge for delivery.
   */
  const [shipping, setShipping] = React.useState("");
  const [discount, setDiscount] = React.useState("0");
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [tracking, setTracking] = React.useState("");
  const [trackingError, setTrackingError] = React.useState<string | null>(null);


  function patchItem(key: string, patch: Partial<DraftItem>) {
    setItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  }

  const itemsAfn = items.reduce(
    (sum, item) => sum + item.unitPriceAfn * item.qty,
    0,
  );
  const serviceFeeAfn = Number(serviceFee) || 0;
  const shippingAfn = Number(shipping) || 0;
  const discountAfn = Number(discount) || 0;
  const totalAfn = itemsAfn + serviceFeeAfn + shippingAfn - discountAfn;

  const estimatedCostAfn = items.reduce(
    (sum, item) => sum + item.unitCostAfn * item.qty,
    0,
  );
  const estimatedProfit = totalAfn - estimatedCostAfn - shippingAfn * 0.75;

  const validItems = items.filter(
    (item) => item.name.trim() && item.qty > 0 && item.unitPriceAfn > 0,
  );
  const invalid = !clientId || validItems.length === 0;

  async function handleSubmit() {
    if (invalid) return;
    setSaving(true);
    setTrackingError(null);
    try {
      const order = await createOrder({
        clientId,
        source,
        items: validItems.map((item) => ({
          name: item.name,
          storeId: item.storeId,
          category: item.category,
          qty: item.qty,
          unitPriceAfn: item.unitPriceAfn,
          unitCostAfn: item.unitCostAfn,
          productUrl: item.productUrl?.trim() || undefined,
          variant: item.variant?.trim() || undefined,
          weightKg: item.weightKg || undefined,
        })),
        serviceFeeAfn,
        shippingChargedAfn: shippingAfn,
        discountAfn,
        notes: notes.trim() || undefined,
        trackingNumber: tracking.trim() || undefined,
      });
      toast.success(`Order ${order.orderNo} created`, {
        description: "It is now in the Requested stage — send a quotation next.",
      });
      router.push(`/orders/${order.id}`);
    } catch (error) {
      // Surfaced beside the field rather than as a toast: a rejected tracking
      // number is something the operator has to correct here and now.
      const message =
        error instanceof Error ? error.message : "Could not create the order.";
      setTrackingError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader description="Capture a client request — the links, quantities and the price you quoted." />

      <div className="grid items-start gap-4 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-5">
          {/* Client & channel ------------------------------------------ */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Client</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="order-client">Who is this for?</Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger id="order-client" className="w-full">
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name} · {client.city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">
                  Not on the list?{" "}
                  <Link href="/clients/new" className="text-primary hover:underline">
                    Add a new client
                  </Link>
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="order-source">How did they contact us?</Label>
                <Select
                  value={source}
                  onValueChange={(v) => setSource(v as OrderSource)}
                >
                  <SelectTrigger id="order-source" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ORDER_SOURCE_LABEL).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Items ------------------------------------------------------ */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Requested products</CardTitle>
              <p className="text-muted-foreground text-xs">
                Paste the link the client sent, then set the quantity and the
                price you are quoting them.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((item, index) => (
                <ItemFields
                  key={item.key}
                  item={item}
                  index={index}
                  stores={stores}
                  canRemove={items.length > 1}
                  onPatch={(patch) => patchItem(item.key, patch)}
                  onRemove={() =>
                    setItems((prev) => prev.filter((i) => i.key !== item.key))
                  }
                />
              ))}

              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setItems((prev) => [
                    ...prev,
                    emptyItem(stores[0]?.id ?? "store-amazon-us"),
                  ])
                }
              >
                <PlusIcon />
                Add another product
              </Button>
            </CardContent>
          </Card>

          {/* Tracking ---------------------------------------------------- */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Tracking number</CardTitle>
              <p className="text-muted-foreground text-xs">
                The number you give the client. Type your own, or press the
                button to generate one. Left empty, we assign one on save.
              </p>
            </CardHeader>
            <CardContent className="grid gap-2 sm:max-w-xs">
              <Label htmlFor="order-tracking" className="sr-only">
                Tracking number
              </Label>
              <div className="flex gap-2">
                <Input
                  id="order-tracking"
                  value={tracking}
                  onChange={(e) => {
                    setTracking(e.target.value.toUpperCase());
                    setTrackingError(null);
                  }}
                  placeholder={`${company.orderPrefix}-2026-0001`}
                  className="tabular"
                  aria-invalid={trackingError !== null}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Generate a tracking number"
                  onClick={() => {
                    setTracking(
                      generateTrackingNumber({
                        year: new Date().getFullYear(),
                        prefix: company.orderPrefix,
                      }),
                    );
                    setTrackingError(null);
                  }}
                >
                  <RefreshCwIcon />
                </Button>
              </div>
              {trackingError ? (
                <p className="text-destructive text-xs" role="alert">
                  {trackingError}
                </p>
              ) : (
                <p className="text-muted-foreground text-xs">
                  Your own reference is fine — letters, numbers and hyphens,
                  e.g. {company.orderPrefix}-2026-0001. Generated numbers avoid
                  I, L, O and U so they cannot be misheard on the phone.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Notes ------------------------------------------------------ */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Internal note</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Delivery preference, deadline, anything the team should know."
                rows={3}
              />
            </CardContent>
          </Card>
        </div>

        {/* Summary rail ------------------------------------------------ */}
        <div className="space-y-4">
          <Card className="xl:sticky xl:top-20">
            <CardHeader>
              <CardTitle className="text-sm">Quotation</CardTitle>
              <p className="text-muted-foreground text-xs">
                The client price you set on each item is what they pay for the
                goods. These three are on top of that, and all three are
                optional — leave them at zero if the item price is the whole
                quote.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="order-fee" className="text-xs">
                    Extra fee
                  </Label>
                  <Input
                    id="order-fee"
                    inputMode="numeric"
                    value={serviceFee}
                    onChange={(e) =>
                      setServiceFee(e.target.value.replace(/[^\d]/g, ""))
                    }
                    className="tabular h-8"
                    placeholder="2500"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="order-shipping" className="text-xs">
                    Delivery
                  </Label>
                  <Input
                    id="order-shipping"
                    inputMode="numeric"
                    value={shipping}
                    onChange={(e) =>
                      setShipping(e.target.value.replace(/[^\d]/g, ""))
                    }
                    className="tabular h-8"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="order-discount" className="text-xs">
                    Discount
                  </Label>
                  <Input
                    id="order-discount"
                    inputMode="numeric"
                    value={discount}
                    onChange={(e) =>
                      setDiscount(e.target.value.replace(/[^\d]/g, ""))
                    }
                    className="tabular h-8"
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-1.5 text-sm">
                <Line label={`Items (${validItems.length})`} value={itemsAfn} />
                <Line label="Extra fee" value={serviceFeeAfn} />
                <Line label="Delivery" value={shippingAfn} />
                {discountAfn > 0 && <Line label="Discount" value={-discountAfn} />}
                <Separator className="my-2" />
                <div className="flex items-center justify-between text-base font-semibold">
                  <span>Total</span>
                  <Money value={totalAfn} />
                </div>
              </div>

              {validItems.length > 0 && (
              <div className="bg-muted/40 space-y-1 rounded-lg border p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Estimated cost</span>
                  <Money value={Math.round(estimatedCostAfn)} tone="muted" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Estimated profit</span>
                  <Money
                    value={Math.round(estimatedProfit)}
                    tone="signed"
                    className="font-medium"
                  />
                </div>
                <p className="text-muted-foreground/80 pt-1">
                  Indicative only — real margin is set when the purchase and
                  freight are logged.
                </p>
              </div>
              )}

              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={invalid || saving}
              >
                {saving ? "Creating…" : "Create order"}
              </Button>
              {invalid && (
                <p className="text-muted-foreground text-center text-xs">
                  Select a client and add at least one product with a price.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function Line({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <Money value={value} />
    </div>
  );
}

/**
 * One product row of the request builder.
 *
 * Field ids come from `useId()` so they are identical on the server and the
 * client — the item's `key` is deliberately never used as a DOM id.
 */
function ItemFields({
  item,
  index,
  stores,
  canRemove,
  onPatch,
  onRemove,
}: {
  item: DraftItem;
  index: number;
  stores: Array<{ id: string; name: string }>;
  canRemove: boolean;
  onPatch: (patch: Partial<DraftItem>) => void;
  onRemove: () => void;
}) {
  const id = React.useId();
  const field = (name: string) => `${id}-${name}`;

  return (
    <div className="bg-muted/25 space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <ProductThumb
            size="sm"
            category={item.category}
            name={item.name || "Product"}
          />
          <span className="text-sm font-medium">Item {index + 1}</span>
        </div>
        {canRemove && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={onRemove}
            aria-label={`Remove item ${index + 1}`}
          >
            <Trash2Icon />
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor={field("name")}>Product name</Label>
          <Input
            id={field("name")}
            value={item.name}
            onChange={(e) => onPatch({ name: e.target.value })}
            placeholder="Apple AirPods Pro (2nd generation)"
          />
        </div>

        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor={field("url")}>Product link</Label>
          <Input
            id={field("url")}
            value={item.productUrl}
            onChange={(e) => onPatch({ productUrl: e.target.value })}
            placeholder="https://www.amazon.com/dp/…"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor={field("store")}>Store</Label>
          <Select
            value={item.storeId}
            onValueChange={(value) => onPatch({ storeId: value })}
          >
            <SelectTrigger id={field("store")} className="w-full">
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
          <Label htmlFor={field("category")}>Category</Label>
          <Select
            value={item.category}
            onValueChange={(value) =>
              onPatch({ category: value as ProductCategory })
            }
          >
            <SelectTrigger id={field("category")} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PRODUCT_CATEGORY_LABEL).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor={field("variant")}>Colour / size (optional)</Label>
          <Input
            id={field("variant")}
            value={item.variant}
            onChange={(e) => onPatch({ variant: e.target.value })}
            placeholder="Natural Titanium"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor={field("weight")}>Weight kg (optional)</Label>
          <Input
            id={field("weight")}
            inputMode="decimal"
            value={item.weightKg || ""}
            onChange={(e) =>
              onPatch({
                weightKg: Number(e.target.value.replace(/[^\d.]/g, "")),
              })
            }
            className="tabular"
            placeholder="0.4"
          />
        </div>

        <div className="grid grid-cols-3 gap-3 sm:col-span-2">
          <div className="grid gap-2">
            <Label htmlFor={field("qty")}>Quantity</Label>
            <Input
              id={field("qty")}
              inputMode="numeric"
              value={item.qty || ""}
              onChange={(e) =>
                onPatch({ qty: Number(e.target.value.replace(/[^\d]/g, "")) })
              }
              className="tabular"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor={field("cost")}>Store cost (AFN/unit)</Label>
            <Input
              id={field("cost")}
              inputMode="numeric"
              value={item.unitCostAfn || ""}
              onChange={(e) => {
                /*
                 * The cost, and nothing else.
                 *
                 * This used to fill in a client price of cost + 15%. Nobody
                 * chose that number, and a price already in the box is a price
                 * that gets quoted — so the margin on an order was whatever the
                 * form had guessed, silently. What the client pays is a
                 * decision, and it stays one.
                 */
                onPatch({ unitCostAfn: Number(e.target.value.replace(/[^\d]/g, "")) });
              }}
              className="tabular"
              placeholder="14000"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor={field("price")}>Client price (AFN/unit)</Label>
            <Input
              id={field("price")}
              inputMode="numeric"
              value={item.unitPriceAfn || ""}
              onChange={(e) =>
                onPatch({
                  unitPriceAfn: Number(e.target.value.replace(/[^\d]/g, "")),
                })
              }
              className="tabular"
              placeholder="14500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
