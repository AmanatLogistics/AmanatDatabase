"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ExternalLinkIcon } from "lucide-react";

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
import { Money, MoneyUsd } from "@/components/shared/money";
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

  const { purchase, order, client, store, totalUsd, totalAfn } = row;
  const method = methodOf(purchase.paymentMethodId);
  const coveredItems =
    order?.items.filter((item) => purchase.orderItemIds.includes(item.id)) ??
    [];

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Purchases", href: "/purchases" },
          { label: purchase.purchaseNo },
        ]}
        title={
          <span className="flex items-center gap-3">
            <Button variant="ghost" size="icon-sm" asChild className="-ml-2">
              <Link href="/purchases" aria-label="Back to purchases">
                <ArrowLeftIcon />
              </Link>
            </Button>
            <span className="tabular">{purchase.purchaseNo}</span>
          </span>
        }
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
              <CardTitle className="text-sm">Cost breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <CostLine label="Items" value={purchase.itemsCostUsd} />
              <CostLine label="Tax" value={purchase.taxUsd} />
              <CostLine
                label="Domestic shipping"
                value={purchase.domesticShippingUsd}
              />
              <CostLine label="Other charges" value={purchase.otherCostUsd} />
              <Separator className="my-2" />
              <div className="flex items-center justify-between font-semibold">
                <span>Total paid</span>
                <MoneyUsd value={totalUsd} />
              </div>
              <Separator className="my-2" />
              <div className="text-muted-foreground flex items-center justify-between text-xs">
                <span>FX rate used</span>
                <span className="tabular">{purchase.fxRate} AFN / USD</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">Cost in Afghani</span>
                <Money
                  value={totalAfn}
                  unit="suffix"
                  className="font-semibold"
                />
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
                <TableHead className="text-right">Est. unit cost (USD)</TableHead>
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
                    <MoneyUsd
                      value={item.unitCostUsd}
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

function CostLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <MoneyUsd value={value} />
    </div>
  );
}
