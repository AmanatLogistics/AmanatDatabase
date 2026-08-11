"use client";

import { notFound } from "next/navigation";

import {
  PrintFooter,
  PrintLetterhead,
  PrintParty,
  PrintShell,
} from "@/features/print/print-shell";
import { useCompany, useOrderRows, useShipment, useStoreLookup } from "@/lib/api";
import { PRODUCT_CATEGORY_LABEL } from "@/lib/constants";
import { formatDate } from "@/lib/format";

export function PackingListDocument({ shipmentId }: { shipmentId: string }) {
  const row = useShipment(shipmentId);
  const orders = useOrderRows();
  const storeOf = useStoreLookup();
  const company = useCompany();

  if (!row) notFound();

  const { shipment, client } = row;
  const orderRow = orders.find((o) => o.order.id === shipment.orderId);
  const items = orderRow?.order.items ?? [];
  const totalUnits = items.reduce((sum, item) => sum + item.qty, 0);

  return (
    <PrintShell
      backHref={`/tracking/${shipment.id}`}
      backLabel="Back to shipment"
      documentTitle={`Packing list ${shipment.trackingNumber}`}
    >
      <PrintLetterhead
        documentLabel="Packing list"
        documentNumber={
          orderRow?.order.orderNo.replace(/^AS-/, "PKL-") ?? shipment.trackingNumber
        }
        meta={[
          { label: "Shipped", value: formatDate(shipment.shippedAt) },
          { label: "Carrier", value: shipment.carrier },
          { label: "Tracking", value: shipment.trackingNumber },
        ]}
      />

      <section className="grid grid-cols-2 gap-8 py-6">
        <PrintParty
          title="Deliver to"
          name={client?.name ?? "Client"}
          lines={[
            client?.address,
            client ? `${client.city}, ${company.country}` : undefined,
            client?.phone,
          ]}
        />
        <div className="text-right text-[11px]">
          <p className="mb-1 text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">
            Consignment
          </p>
          <dl className="space-y-0.5">
            <Row label="Origin" value={shipment.origin} />
            <Row label="Destination" value={shipment.destination} />
            <Row label="Gross weight" value={`${shipment.weightKg} kg`} />
            <Row label="Pieces" value={String(totalUnits)} />
            <Row label="Order" value={orderRow?.order.orderNo ?? "—"} />
          </dl>
        </div>
      </section>

      <table className="w-full border-collapse text-[11.5px]">
        <thead>
          <tr className="border-y border-neutral-300 bg-neutral-50">
            <th className="w-8 px-2 py-2 text-left font-semibold">#</th>
            <th className="px-2 py-2 text-left font-semibold">Description</th>
            <th className="px-2 py-2 text-left font-semibold">Origin</th>
            <th className="px-2 py-2 text-right font-semibold">Qty</th>
            <th className="px-2 py-2 text-right font-semibold">Weight</th>
            <th className="w-14 px-2 py-2 text-center font-semibold">✓</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const store = storeOf(item.storeId);
            return (
              <tr key={item.id} className="border-b border-neutral-200 align-top">
                <td className="px-2 py-2.5 text-neutral-500">{index + 1}</td>
                <td className="px-2 py-2.5">
                  <p className="font-medium text-neutral-900">{item.name}</p>
                  <p className="text-[10.5px] text-neutral-500">
                    {PRODUCT_CATEGORY_LABEL[item.category]}
                    {item.variant ? ` · ${item.variant}` : ""}
                  </p>
                </td>
                <td className="px-2 py-2.5 text-neutral-600">
                  {store?.country ?? "—"}
                </td>
                <td className="px-2 py-2.5 text-right font-mono">{item.qty}</td>
                <td className="px-2 py-2.5 text-right font-mono">
                  {item.weightKg ? `${item.weightKg} kg` : "—"}
                </td>
                <td className="px-2 py-2.5 text-center">
                  <span className="inline-block size-3.5 border border-neutral-400" />
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-b border-neutral-300 font-semibold">
            <td colSpan={3} className="px-2 py-2.5">
              Total
            </td>
            <td className="px-2 py-2.5 text-right font-mono">{totalUnits}</td>
            <td className="px-2 py-2.5 text-right font-mono">
              {shipment.weightKg} kg
            </td>
            <td />
          </tr>
        </tfoot>
      </table>

      <section className="mt-6 rounded-md border border-neutral-300 p-3 text-[11px] text-neutral-700">
        <p className="font-semibold text-neutral-800">
          No commercial value declaration
        </p>
        <p className="mt-0.5">
          Goods purchased on behalf of the consignee named above. Customs duty
          and clearance charges are payable by the consignee on arrival.
        </p>
      </section>

      <section className="mt-10 grid grid-cols-2 gap-10 text-[11px]">
        <div>
          <div className="h-10 border-b border-neutral-400" />
          <p className="mt-1 text-neutral-500">Packed and checked by</p>
        </div>
        <div>
          <div className="h-10 border-b border-neutral-400" />
          <p className="mt-1 text-neutral-500">Received by (date &amp; signature)</p>
        </div>
      </section>

      <PrintFooter showTerms={false} />
    </PrintShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-end gap-2">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="font-medium text-neutral-800">{value}</dd>
    </div>
  );
}
