"use client";

import * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  ExternalLinkIcon,
  PrinterIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Money } from "@/components/shared/money";
import { PageHeader } from "@/components/shared/page-header";
import { ProductThumb } from "@/components/shared/product-thumb";
import { StatusBadge } from "@/components/shared/status-badge";
import { Timeline } from "@/components/shared/timeline";
import { updateShipmentStatus, useShipment } from "@/lib/api";
import { SHIPMENT_PIPELINE, SHIPMENT_STATUS } from "@/lib/constants";
import { formatDate, formatRelative } from "@/lib/format";
import type { ShipmentStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_LOCATION: Record<ShipmentStatus, string> = {
  label_created: "Forwarder warehouse",
  picked_up: "Origin facility",
  in_transit: "In transit",
  customs: "Kabul Customs House",
  out_for_delivery: "Kabul, Afghanistan",
  delivered: "Shahr-e-Naw, Kabul",
  exception: "Kabul, Afghanistan",
};

export function ShipmentDetailScreen({ shipmentId }: { shipmentId: string }) {
  const row = useShipment(shipmentId);

  if (!row) notFound();

  const { shipment, order, client, daysToEta } = row;
  const currentIndex = SHIPMENT_PIPELINE.indexOf(shipment.status);

  async function handleStatus(next: ShipmentStatus) {
    await updateShipmentStatus(
      shipment.id,
      next,
      STATUS_LOCATION[next],
      `Status updated to ${SHIPMENT_STATUS[next].label.toLowerCase()}.`,
    );
    toast.success(`Shipment marked ${SHIPMENT_STATUS[next].label}`);
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Tracking", href: "/tracking" },
          { label: shipment.trackingNumber },
        ]}
        title={
          <span className="flex items-center gap-3">
            <Button variant="ghost" size="icon-sm" asChild className="-ml-2">
              <Link href="/tracking" aria-label="Back to tracking">
                <ArrowLeftIcon />
              </Link>
            </Button>
            <span className="tabular">{shipment.trackingNumber}</span>
          </span>
        }
        meta={<StatusBadge kind="shipment" value={shipment.status} />}
        description={
          <>
            {shipment.carrier} · {shipment.origin} → {shipment.destination}
          </>
        }
        actions={
          <>
            {shipment.trackingUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={shipment.trackingUrl} target="_blank" rel="noreferrer">
                  Carrier site
                  <ExternalLinkIcon />
                </a>
              </Button>
            )}
            <Button variant="outline" size="sm" asChild>
              <Link href={`/print/label/${shipment.id}`} target="_blank">
                <PrinterIcon />
                Label
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm">Update status</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Mark shipment as</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {SHIPMENT_PIPELINE.map((status) => (
                  <DropdownMenuItem
                    key={status}
                    disabled={status === shipment.status}
                    onSelect={() => handleStatus(status)}
                  >
                    <span
                      className={cn(
                        "size-2 rounded-full",
                        SHIPMENT_STATUS[status].dot,
                      )}
                    />
                    {SHIPMENT_STATUS[status].label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => handleStatus("exception")}
                >
                  Report exception
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      {/* Progress rail ------------------------------------------------- */}
      <Card className="p-5">
        <ol className="flex items-start gap-y-4">
          {SHIPMENT_PIPELINE.map((step, index) => {
            const done =
              index < currentIndex || shipment.status === "delivered";
            const current = index === currentIndex && !done;
            return (
              <li key={step} className="flex flex-1 items-start gap-2 last:flex-none">
                <div className="flex w-[84px] shrink-0 flex-col items-center gap-1.5">
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold",
                      done && "bg-primary border-primary text-primary-foreground",
                      current &&
                        "border-primary text-primary ring-primary/20 ring-4",
                      !done && !current && "border-border text-muted-foreground",
                    )}
                  >
                    {done ? <CheckCircle2Icon className="size-3.5" /> : index + 1}
                  </span>
                  {/* Fixed height so two-line labels keep the rail level. */}
                  <span
                    className={cn(
                      "flex h-7 items-start justify-center text-center text-[10.5px] leading-tight text-balance",
                      current || done
                        ? "text-foreground font-medium"
                        : "text-muted-foreground",
                    )}
                  >
                    {SHIPMENT_STATUS[step].label}
                  </span>
                </div>
                {index < SHIPMENT_PIPELINE.length - 1 && (
                  <span
                    className={cn(
                      "mt-3.5 h-px flex-1",
                      done ? "bg-primary" : "bg-border",
                    )}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </Card>

      <div className="grid items-start gap-4 xl:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Delivery timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <Timeline
              entries={shipment.events
                .slice()
                .reverse()
                .map((event) => ({
                  id: event.id,
                  at: event.at,
                  title: event.description,
                  description: event.location,
                  dot: SHIPMENT_STATUS[event.status].dot,
                  meta: (
                    <span className="text-muted-foreground text-xs">
                      {SHIPMENT_STATUS[event.status].label}
                    </span>
                  ),
                }))}
            />
          </CardContent>
        </Card>

        <div className="space-y-4 xl:sticky xl:top-20">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Shipment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Field label="Carrier" value={shipment.carrier} />
              <Field
                label="Tracking number"
                value={<span className="tabular">{shipment.trackingNumber}</span>}
              />
              <Field label="Origin" value={shipment.origin} />
              <Field label="Destination" value={shipment.destination} />
              <Field label="Weight" value={`${shipment.weightKg} kg`} />
              <Separator />
              <Field label="Shipped" value={formatDate(shipment.shippedAt)} />
              <Field
                label={shipment.deliveredAt ? "Delivered" : "Estimated arrival"}
                value={
                  shipment.deliveredAt ? (
                    <span className="text-success">
                      {formatDate(shipment.deliveredAt)}
                    </span>
                  ) : (
                    <span
                      className={cn(
                        daysToEta !== null && daysToEta < 0 && "text-destructive",
                      )}
                    >
                      {formatDate(shipment.etaAt)}
                      {shipment.etaAt && ` (${formatRelative(shipment.etaAt)})`}
                    </span>
                  )
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-baseline justify-between text-sm">
                Landed cost
                <span className="text-muted-foreground text-[11px] font-normal">
                  AFN
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Freight</span>
                <Money value={shipment.freightCostAfn} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Customs duty</span>
                <Money value={shipment.customsDutyAfn} />
              </div>
              <Separator className="my-2" />
              <div className="flex items-center justify-between font-semibold">
                <span>Total</span>
                <Money
                  value={shipment.freightCostAfn + shipment.customsDutyAfn}
                />
              </div>
            </CardContent>
          </Card>

          {order && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Contents</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Link
                    href={`/orders/${order.id}`}
                    className="tabular font-medium hover:underline"
                  >
                    {order.orderNo}
                  </Link>
                  {client && (
                    <p className="text-muted-foreground text-xs">
                      for{" "}
                      <Link
                        href={`/clients/${client.id}`}
                        className="hover:underline"
                      >
                        {client.name}
                      </Link>
                    </p>
                  )}
                </div>
                <Separator />
                <ul className="space-y-2.5">
                  {order.items.map((item) => (
                    <li key={item.id} className="flex items-center gap-2.5">
                      <ProductThumb
                        size="sm"
                        category={item.category}
                        imageUrl={item.imageUrl}
                        name={item.name}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px]">{item.name}</p>
                        <p className="text-muted-foreground text-xs">
                          {item.qty} × {item.weightKg ?? "—"} kg
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link href={`/print/packing-list/${shipment.id}`} target="_blank">
                    <PrinterIcon />
                    Print packing list
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground shrink-0 text-xs">{label}</span>
      <span className="text-right text-[13px]">{value}</span>
    </div>
  );
}
