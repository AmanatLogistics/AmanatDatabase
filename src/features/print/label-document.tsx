"use client";

import { notFound } from "next/navigation";

import { LogoMark } from "@/components/brand/logo";
import { PrintShell } from "@/features/print/print-shell";
import { useCompany, useOrderRows, useShipment } from "@/lib/api";
import { formatDate } from "@/lib/format";

/**
 * Compact shipping label sized for a 148mm (A5) thermal or sticker sheet.
 * The "barcode" is a deterministic bar pattern derived from the tracking
 * number — it is a visual stand-in, not a scannable Code128.
 */
export function LabelDocument({ shipmentId }: { shipmentId: string }) {
  const row = useShipment(shipmentId);
  const orders = useOrderRows();
  const company = useCompany();

  if (!row) notFound();

  const { shipment, client } = row;
  const orderRow = orders.find((o) => o.order.id === shipment.orderId);
  const totalUnits =
    orderRow?.order.items.reduce((sum, item) => sum + item.qty, 0) ?? 0;

  return (
    <PrintShell
      backHref={`/tracking/${shipment.id}`}
      backLabel="Back to shipment"
      documentTitle={`Label ${shipment.trackingNumber}`}
      width="label"
    >
      {/* Header ---------------------------------------------------- */}
      <div className="flex items-center justify-between border-b-2 border-neutral-900 pb-3">
        <div className="flex items-center gap-2">
          <span
            className="flex size-9 items-center justify-center rounded-lg text-white"
            style={{ backgroundColor: "#7B1E3C" }}
          >
            <LogoMark className="size-5" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-bold">{company.name}</p>
            <p className="text-[9px] text-neutral-500">{company.phone}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[9px] tracking-wider text-neutral-500 uppercase">
            Carrier
          </p>
          <p className="text-sm font-bold">{shipment.carrier}</p>
        </div>
      </div>

      {/* Addresses ------------------------------------------------- */}
      <div className="grid grid-cols-2 gap-4 border-b border-neutral-300 py-3 text-[10px]">
        <div>
          <p className="mb-1 font-semibold tracking-wider text-neutral-500 uppercase">
            From
          </p>
          <p className="font-semibold text-neutral-900">{company.name}</p>
          <p className="text-neutral-700">{company.addressLine1}</p>
          <p className="text-neutral-700">{company.addressLine2}</p>
          <p className="text-neutral-700">
            {company.city}, {company.country}
          </p>
          <p className="text-neutral-700">{company.phone}</p>
        </div>
        <div>
          <p className="mb-1 font-semibold tracking-wider text-neutral-500 uppercase">
            Origin
          </p>
          <p className="text-neutral-700">{shipment.origin}</p>
          <p className="mt-2 mb-1 font-semibold tracking-wider text-neutral-500 uppercase">
            Shipped
          </p>
          <p className="text-neutral-700">{formatDate(shipment.shippedAt)}</p>
        </div>
      </div>

      {/* Recipient — the big block ---------------------------------- */}
      <div className="border-b-2 border-neutral-900 py-4">
        <p className="mb-1.5 text-[9px] font-semibold tracking-wider text-neutral-500 uppercase">
          Deliver to
        </p>
        <p className="text-xl leading-tight font-bold text-neutral-900">
          {client?.name ?? "Client"}
        </p>
        <div className="mt-1 space-y-0.5 text-[12px] text-neutral-800">
          {client?.address && <p>{client.address}</p>}
          <p className="font-semibold">
            {client?.city}, {company.country}
          </p>
          <p className="font-mono">{client?.phone}</p>
        </div>
      </div>

      {/* Consignment details ---------------------------------------- */}
      <div className="grid grid-cols-3 gap-2 border-b border-neutral-300 py-3 text-center">
        <Cell label="Weight" value={`${shipment.weightKg} kg`} />
        <Cell label="Pieces" value={String(totalUnits)} />
        <Cell label="Order" value={orderRow?.order.orderNo ?? "—"} />
      </div>

      {/* Tracking + barcode ----------------------------------------- */}
      <div className="pt-4 text-center">
        <p className="text-[9px] font-semibold tracking-wider text-neutral-500 uppercase">
          Tracking number
        </p>
        <p className="mt-0.5 font-mono text-lg font-bold tracking-wide">
          {shipment.trackingNumber}
        </p>
        <Barcode value={shipment.trackingNumber} />
        <p className="mt-2 text-[9px] text-neutral-500">
          Customs duty and clearance payable by the consignee on arrival.
        </p>
      </div>
    </PrintShell>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] tracking-wider text-neutral-500 uppercase">
        {label}
      </p>
      <p className="font-mono text-sm font-bold">{value}</p>
    </div>
  );
}

/** Deterministic bar pattern — a visual placeholder for a real barcode. */
function Barcode({ value }: { value: string }) {
  const bars: number[] = [];
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    bars.push(1 + (code % 3), 1 + ((code >> 2) % 3), 1 + ((code >> 4) % 2));
  }

  return (
    <div
      aria-hidden
      className="mt-2 flex h-12 items-stretch justify-center gap-[1px] overflow-hidden"
    >
      {bars.map((weight, index) => (
        <span
          key={index}
          className={index % 2 === 0 ? "bg-neutral-900" : "bg-transparent"}
          style={{ width: `${weight}px` }}
        />
      ))}
    </div>
  );
}
