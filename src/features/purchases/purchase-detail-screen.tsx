"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLinkIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
import { usePaymentMethodLookup, usePurchase } from "@/lib/api";
import { PRODUCT_CATEGORY_LABEL } from "@/lib/constants";
import { formatDate, hostnameOf } from "@/lib/format";

export function PurchaseDetailScreen({ purchaseId }: { purchaseId: string }) {
  const row = usePurchase(purchaseId);
  const methodOf = usePaymentMethodLookup();

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
    </>
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
