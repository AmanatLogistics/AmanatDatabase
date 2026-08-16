"use client";

import { notFound } from "next/navigation";

import {
  PrintFooter,
  PrintLetterhead,
  PrintParty,
  PrintShell,
} from "@/features/print/print-shell";
import { useClientPayments, useCompany, useOrder, useStoreLookup } from "@/lib/api";
import { ORDER_STATUS, PRODUCT_CATEGORY_LABEL } from "@/lib/constants";
import { formatAfn, formatDate } from "@/lib/format";

/**
 * Invoice and quotation share a layout — a quotation is simply the same sheet
 * before the client has committed, so it carries a validity note instead of
 * payment status.
 */
export function InvoiceDocument({
  orderId,
  variant,
}: {
  orderId: string;
  variant: "invoice" | "quotation";
}) {
  const row = useOrder(orderId);
  const company = useCompany();
  const storeOf = useStoreLookup();
  const payments = useClientPayments(row?.order.clientId ?? "").filter(
    (p) => p.payment.orderId === orderId,
  );

  if (!row) notFound();

  const { order, client, economics } = row;
  const isInvoice = variant === "invoice";
  const number = order.orderNo.replace(/^AS-/, isInvoice ? "INV-" : "QUO-");

  return (
    <PrintShell
      backHref={`/orders/${order.id}`}
      backLabel={`Back to ${order.orderNo}`}
      documentTitle={`${isInvoice ? "Invoice" : "Quotation"} ${number}`}
    >
      <PrintLetterhead
        documentLabel={isInvoice ? "Invoice" : "Quotation"}
        documentNumber={number}
        meta={[
          { label: "Date", value: formatDate(order.requestedAt) },
          { label: "Order", value: order.orderNo },
          {
            label: isInvoice ? "Status" : "Valid until",
            value: isInvoice
              ? ORDER_STATUS[order.status].label
              : formatDate(
                  new Date(
                    new Date(order.requestedAt).getTime() + 7 * 86_400_000,
                  ).toISOString(),
                ),
          },
        ]}
      />

      <section className="grid grid-cols-2 gap-8 py-6">
        <PrintParty
          title={isInvoice ? "Bill to" : "Prepared for"}
          name={client?.name ?? "Client"}
          lines={[
            client?.code,
            client?.address,
            client ? `${client.city}, ${company.country}` : undefined,
            client?.phone,
            client?.email,
          ]}
        />
        <div className="text-right">
          <p className="mb-1 text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">
            {isInvoice ? "Amount due" : "Quoted total"}
          </p>
          <p className="text-3xl font-bold tracking-tight text-neutral-900">
            {formatAfn(isInvoice ? economics.balanceAfn : economics.revenue.totalAfn, { unit: "suffix" })}
          </p>
          <p className="mt-1 text-[11px] text-neutral-500">
            {isInvoice
              ? `of ${formatAfn(economics.revenue.totalAfn, { unit: "suffix" })} total`
              : "excluding customs charges payable on arrival"}
          </p>
        </div>
      </section>

      {/* Line items ------------------------------------------------- */}
      <table className="w-full border-collapse text-[11.5px]">
        <thead>
          <tr className="border-y border-neutral-300 bg-neutral-50">
            <th className="w-8 px-2 py-2 text-left font-semibold">#</th>
            <th className="px-2 py-2 text-left font-semibold">Description</th>
            <th className="px-2 py-2 text-right font-semibold">Qty</th>
            <th className="px-2 py-2 text-right font-semibold">Unit price</th>
            <th className="px-2 py-2 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item, index) => {
            const store = storeOf(item.storeId);
            return (
              <tr key={item.id} className="border-b border-neutral-200 align-top">
                <td className="px-2 py-2.5 text-neutral-500">{index + 1}</td>
                <td className="px-2 py-2.5">
                  <p className="font-medium text-neutral-900">{item.name}</p>
                  <p className="text-[10.5px] text-neutral-500">
                    {PRODUCT_CATEGORY_LABEL[item.category]}
                    {item.variant ? ` · ${item.variant}` : ""}
                    {store ? ` · sourced from ${store.name}` : ""}
                  </p>
                </td>
                <td className="px-2 py-2.5 text-right font-mono">{item.qty}</td>
                <td className="px-2 py-2.5 text-right font-mono">
                  {formatAfn(item.unitPriceAfn)}
                </td>
                <td className="px-2 py-2.5 text-right font-mono font-medium">
                  {formatAfn(item.unitPriceAfn * item.qty)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Totals ----------------------------------------------------- */}
      <section className="mt-5 flex justify-end">
        <div className="w-[62%] space-y-1 text-[11.5px]">
          <TotalRow
            label="Items subtotal"
            value={economics.revenue.itemsAfn}
          />
          <TotalRow
            label="Service fee"
            value={economics.revenue.serviceFeeAfn}
          />
          <TotalRow label="Shipping & handling" value={economics.revenue.shippingAfn} />
          {economics.revenue.discountAfn > 0 && (
            <TotalRow label="Discount" value={-economics.revenue.discountAfn} />
          )}
          <div className="mt-1 flex items-center justify-between border-t border-neutral-300 pt-2 text-sm font-bold">
            <span>Total ({company.currency})</span>
            <span className="font-mono">
              {formatAfn(economics.revenue.totalAfn)}
            </span>
          </div>

          {isInvoice && (
            <>
              <div className="pt-2">
                {payments.map(({ payment, method }) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between py-0.5 text-neutral-600"
                  >
                    <span>
                      {payment.receiptNo} · {formatDate(payment.at)} ·{" "}
                      {method?.name}
                    </span>
                    <span className="font-mono">
                      −{formatAfn(payment.amountAfn)}
                    </span>
                  </div>
                ))}
                {payments.length === 0 && (
                  <p className="py-0.5 text-neutral-500">No payments received</p>
                )}
              </div>
              <div className="flex items-center justify-between border-t border-neutral-300 pt-2 text-sm font-bold">
                <span>Balance due</span>
                <span className="font-mono">
                  {formatAfn(economics.balanceAfn, { unit: "suffix" })}
                </span>
              </div>
            </>
          )}
        </div>
      </section>

      {order.notes && (
        <section className="mt-6 rounded-md bg-neutral-50 p-3 text-[11px] text-neutral-700">
          <p className="mb-0.5 font-semibold">Note</p>
          <p>{order.notes}</p>
        </section>
      )}

      {isInvoice && (
        <section className="mt-6 text-[11px]">
          <p className="mb-1 font-semibold text-neutral-800">How to pay</p>
          <p className="text-neutral-600">
            Cash at the shop, or transfer to any of our accounts — please quote{" "}
            <span className="font-mono font-medium">{number}</span> as the
            reference.
          </p>
        </section>
      )}

      <PrintFooter />
    </PrintShell>
  );
}

function TotalRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-neutral-600">{label}</span>
      <span className="font-mono">{formatAfn(value)}</span>
    </div>
  );
}
