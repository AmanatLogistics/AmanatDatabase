"use client";

import { notFound } from "next/navigation";

import {
  PrintFooter,
  PrintLetterhead,
  PrintParty,
  PrintShell,
} from "@/features/print/print-shell";
import {
  useCompany,
  useOrderRows,
  usePaymentMethodLookup,
  usePaymentRows,
} from "@/lib/api";
import { PAYMENT_TYPE } from "@/lib/constants";
import { formatAfn, formatDateTime } from "@/lib/format";

export function ReceiptDocument({ paymentId }: { paymentId: string }) {
  const payments = usePaymentRows();
  const orders = useOrderRows();
  const methodOf = usePaymentMethodLookup();
  const company = useCompany();

  const row = payments.find((p) => p.payment.id === paymentId);
  if (!row) notFound();

  const { payment, client } = row;
  const orderRow = orders.find((o) => o.order.id === payment.orderId);
  const method = methodOf(payment.methodId);

  return (
    <PrintShell
      backHref={payment.orderId ? `/orders/${payment.orderId}` : "/payments"}
      backLabel={payment.orderId ? "Back to order" : "Back to payments"}
      documentTitle={`Receipt ${payment.receiptNo}`}
    >
      <PrintLetterhead
        documentLabel="Receipt"
        documentNumber={payment.receiptNo}
        meta={[
          { label: "Date", value: formatDateTime(payment.at) },
          { label: "Method", value: method?.name ?? "—" },
          { label: "Type", value: PAYMENT_TYPE[payment.type].label },
        ]}
      />

      <section className="grid grid-cols-2 gap-8 py-6">
        <PrintParty
          title="Received from"
          name={client?.name ?? "Client"}
          lines={[
            client?.code,
            client?.address,
            client ? `${client.city}, ${company.country}` : undefined,
            client?.phone,
          ]}
        />
        <div className="text-right">
          <p className="mb-1 text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">
            Amount received
          </p>
          <p className="text-3xl font-bold tracking-tight text-neutral-900">
            {formatAfn(payment.amountAfn)}
          </p>
          {payment.reference && (
            <p className="mt-1 font-mono text-[11px] text-neutral-500">
              Ref {payment.reference}
            </p>
          )}
        </div>
      </section>

      <table className="w-full border-collapse text-[11.5px]">
        <thead>
          <tr className="border-y border-neutral-300 bg-neutral-50">
            <th className="px-2 py-2 text-left font-semibold">Applied to</th>
            <th className="px-2 py-2 text-left font-semibold">Description</th>
            <th className="px-2 py-2 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-neutral-200">
            <td className="px-2 py-3 font-mono">
              {orderRow?.order.orderNo ?? "On account"}
            </td>
            <td className="px-2 py-3">
              {orderRow
                ? `${orderRow.order.items.length} item${
                    orderRow.order.items.length > 1 ? "s" : ""
                  } — ${orderRow.order.items[0]?.name ?? ""}`
                : "Unallocated credit on the client account"}
            </td>
            <td className="px-2 py-3 text-right font-mono font-medium">
              {formatAfn(payment.amountAfn, { symbol: false })}
            </td>
          </tr>
        </tbody>
      </table>

      {orderRow && (
        <section className="mt-5 flex justify-end">
          <div className="w-[62%] space-y-1 text-[11.5px]">
            <div className="flex items-center justify-between py-0.5">
              <span className="text-neutral-600">Order total</span>
              <span className="font-mono">
                {formatAfn(orderRow.economics.revenue.totalAfn, { symbol: false })}
              </span>
            </div>
            <div className="flex items-center justify-between py-0.5">
              <span className="text-neutral-600">Total paid to date</span>
              <span className="font-mono">
                {formatAfn(orderRow.economics.paidAfn, { symbol: false })}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between border-t border-neutral-300 pt-2 text-sm font-bold">
              <span>Remaining balance</span>
              <span className="font-mono">
                {formatAfn(orderRow.economics.balanceAfn)}
              </span>
            </div>
          </div>
        </section>
      )}

      {payment.note && (
        <section className="mt-6 rounded-md bg-neutral-50 p-3 text-[11px] text-neutral-700">
          <p className="mb-0.5 font-semibold">Note</p>
          <p>{payment.note}</p>
        </section>
      )}

      <section className="mt-10 grid grid-cols-2 gap-10 text-[11px]">
        <div>
          <div className="h-10 border-b border-neutral-400" />
          <p className="mt-1 text-neutral-500">Received by ({payment.recordedBy})</p>
        </div>
        <div>
          <div className="h-10 border-b border-neutral-400" />
          <p className="mt-1 text-neutral-500">Client signature</p>
        </div>
      </section>

      <PrintFooter showTerms={false} />
    </PrintShell>
  );
}
