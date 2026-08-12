"use client";

import * as React from "react";
import Link from "next/link";
import { BanknoteIcon, CheckCircle2Icon, PhoneIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { SearchInput } from "@/components/shared/filter-bar";
import { Money } from "@/components/shared/money";
import { PageHeader } from "@/components/shared/page-header";
import { RecordPaymentDialog } from "@/features/payments/record-payment-dialog";
import { useReceivablesAging } from "@/lib/api";
import { AGING_BUCKET_LABEL, type AgingBucket } from "@/lib/finance";
import { formatAfn, initials } from "@/lib/format";
import { cn } from "@/lib/utils";

const BUCKETS = Object.keys(AGING_BUCKET_LABEL) as AgingBucket[];

const BUCKET_TONE: Record<AgingBucket, string> = {
  current: "text-muted-foreground",
  d1_30: "text-info",
  d31_60: "text-warning-foreground dark:text-warning",
  d60_plus: "text-destructive font-medium",
};

export function BalancesScreen() {
  const { rows, totals, grandTotal } = useReceivablesAging();
  const [search, setSearch] = React.useState("");
  const [payingClientId, setPayingClientId] = React.useState<string | null>(null);

  const filtered = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter(({ client }) =>
      `${client.name} ${client.code} ${client.city} ${client.phone}`
        .toLowerCase()
        .includes(query),
    );
  }, [rows, search]);

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Finance", href: "/finance" },
          { label: "Client balances" },
        ]}
        title="Client balances"
        description="Who owes us money and how long it has been outstanding."
        meta={
          <span className="text-muted-foreground text-sm">
            <Money value={grandTotal} className="text-destructive" /> across{" "}
            {rows.length} clients
          </span>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {BUCKETS.map((bucket) => (
          <Card key={bucket} className="p-4">
            <p className="text-muted-foreground text-[13px]">
              {AGING_BUCKET_LABEL[bucket]}
            </p>
            <p
              className={cn(
                "tabular mt-1 text-xl font-semibold",
                bucket === "d60_plus" && "text-destructive",
                bucket === "d31_60" && "text-warning-foreground dark:text-warning",
              )}
            >
              {formatAfn(totals[bucket] ?? 0, { unit: "suffix" })}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {grandTotal > 0
                ? `${Math.round(((totals[bucket] ?? 0) / grandTotal) * 100)}% of total`
                : "—"}
            </p>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden py-0">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Ageing report</CardTitle>
              <p className="text-muted-foreground text-xs">
                Balances age from 14 days after the order was requested.
              </p>
            </div>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search client…"
              className="w-full sm:w-56"
            />
          </div>
        </CardHeader>

        <CardContent className="px-0 pt-3 pb-0">
          {filtered.length === 0 ? (
            <EmptyState
              icon={CheckCircle2Icon}
              title={
                rows.length === 0
                  ? "Every client is settled"
                  : "No clients match this search"
              }
              description={
                rows.length === 0
                  ? "Nothing is outstanding right now."
                  : undefined
              }
            />
          ) : (
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent">
                  <TableHead>Client</TableHead>
                  {BUCKETS.map((bucket) => (
                    <TableHead key={bucket} className="text-right">
                      {AGING_BUCKET_LABEL[bucket]}
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Total owed (AFN)</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(({ client, summary, buckets, totalAfn }) => (
                  <TableRow key={client.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <span className="bg-brand-700/10 text-brand-700 dark:bg-brand-400/15 dark:text-brand-300 flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold">
                          {initials(client.name)}
                        </span>
                        <div className="min-w-0">
                          <Link
                            href={`/clients/${client.id}`}
                            className="block truncate text-[13px] font-medium hover:underline"
                          >
                            {client.name}
                          </Link>
                          <p className="text-muted-foreground text-xs">
                            {client.city} · {summary.orderCount} orders
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    {BUCKETS.map((bucket) => (
                      <TableCell key={bucket} className="text-right">
                        {buckets[bucket] > 0 ? (
                          <Money
                            value={buckets[bucket]}
                            className={cn("text-[13px]", BUCKET_TONE[bucket])}
                          />
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </TableCell>
                    ))}
                    <TableCell className="text-right">
                      <Money
                        value={totalAfn}
                        className="text-[13px] font-semibold"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" asChild>
                          <a href={`tel:${client.phone}`} aria-label="Call client">
                            <PhoneIcon />
                          </a>
                        </Button>
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => setPayingClientId(client.id)}
                        >
                          <BanknoteIcon />
                          Record
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="hover:bg-transparent">
                  <TableCell className="text-[13px] font-medium">
                    Total ({filtered.length} clients)
                  </TableCell>
                  {BUCKETS.map((bucket) => (
                    <TableCell key={bucket} className="text-right">
                      <Money
                        value={filtered.reduce(
                          (sum, row) => sum + row.buckets[bucket],
                          0,
                        )}
                        className="text-[13px] font-medium"
                      />
                    </TableCell>
                  ))}
                  <TableCell className="text-right">
                    <Money
                      value={filtered.reduce((sum, row) => sum + row.totalAfn, 0)}
                      className="text-destructive text-[13px] font-semibold"
                    />
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>

      <RecordPaymentDialog
        open={!!payingClientId}
        onOpenChange={(open) => !open && setPayingClientId(null)}
        clientId={payingClientId ?? undefined}
      />
    </>
  );
}
