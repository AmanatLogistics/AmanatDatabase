"use client";

import * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeftIcon,
  BanknoteIcon,
  CreditCardIcon,
  MailIcon,
  MapPinIcon,
  MessageCircleIcon,
  PhoneIcon,
  PlusIcon,
  PrinterIcon,
  ReceiptTextIcon,
  ShoppingCartIcon,
  TrendingUpIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { Money } from "@/components/shared/money";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { RecordPaymentDialog } from "@/features/payments/record-payment-dialog";
import {
  useClient,
  useClientOrders,
  useClientPayments,
} from "@/lib/api";
import {
  CLIENT_TYPE_LABEL,
  CONTACT_CHANNEL_LABEL,
} from "@/lib/constants";
import { formatAfn, formatDate, formatRelative, initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ClientDetailScreen({ clientId }: { clientId: string }) {
  const row = useClient(clientId);
  const orders = useClientOrders(clientId);
  const payments = useClientPayments(clientId);
  const [paymentOpen, setPaymentOpen] = React.useState(false);

  if (!row) notFound();

  const { client, summary } = row;

  const digits = (value?: string) => (value ?? "").replace(/\D/g, "");
  const sameWhatsapp =
    !!client.whatsapp && digits(client.whatsapp) === digits(client.phone);

  /** Running-balance statement: orders debit, payments credit. */
  const ledger = React.useMemo(() => {
    const entries: Array<{
      id: string;
      at: string;
      description: string;
      href: string;
      debit: number;
      credit: number;
    }> = [];

    orders.forEach(({ order, economics }) => {
      if (economics.revenue.totalAfn === 0) return;
      if (["requested", "quoted", "cancelled"].includes(order.status)) return;
      entries.push({
        id: `order-${order.id}`,
        at: order.requestedAt,
        description: `Order ${order.orderNo} — ${order.items.length} item${order.items.length > 1 ? "s" : ""}`,
        href: `/orders/${order.id}`,
        debit: economics.revenue.totalAfn,
        credit: 0,
      });
    });

    payments.forEach(({ payment, method }) => {
      entries.push({
        id: `payment-${payment.id}`,
        at: payment.at,
        description: `${payment.receiptNo} — ${method?.name ?? "payment"}`,
        href: `/print/receipt/${payment.id}`,
        debit: 0,
        credit: payment.amountAfn,
      });
    });

    entries.sort((a, b) => a.at.localeCompare(b.at));

    let balance = 0;
    return entries.map((entry) => {
      balance += entry.debit - entry.credit;
      return { ...entry, balance };
    });
  }, [orders, payments]);

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Clients", href: "/clients" },
          { label: client.name },
        ]}
        title={
          <span className="flex items-center gap-3">
            <Button variant="ghost" size="icon-sm" asChild className="-ml-2">
              <Link href="/clients" aria-label="Back to clients">
                <ArrowLeftIcon />
              </Link>
            </Button>
            {client.name}
          </span>
        }
        meta={<StatusBadge kind="client" value={client.status} />}
        description={
          <>
            {client.code} · {CLIENT_TYPE_LABEL[client.type]} · client since{" "}
            {formatDate(client.createdAt)}
          </>
        }
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setPaymentOpen(true)}>
              <CreditCardIcon />
              Record payment
            </Button>
            <Button size="sm" asChild>
              <Link href="/orders/new">
                <PlusIcon />
                New order
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Lifetime revenue"
          value={formatAfn(summary.lifetimeRevenueAfn, { unit: "suffix" })}
          caption={`across ${summary.orderCount} orders`}
          icon={ShoppingCartIcon}
          accent="brand"
        />
        <StatCard
          label="Gross profit earned"
          value={formatAfn(summary.lifetimeProfitAfn, { unit: "suffix" })}
          caption={
            summary.lifetimeRevenueAfn > 0
              ? `${((summary.lifetimeProfitAfn / summary.lifetimeRevenueAfn) * 100).toFixed(1)}% margin`
              : "—"
          }
          icon={TrendingUpIcon}
          accent="success"
        />
        <StatCard
          label="Outstanding balance"
          value={formatAfn(summary.balanceAfn, { unit: "suffix" })}
          caption={
            summary.balanceAfn > 0
              ? `oldest debt ${summary.oldestDebtDays} days`
              : "fully settled"
          }
          icon={BanknoteIcon}
          accent={summary.balanceAfn > 0 ? "destructive" : "success"}
        />
        <StatCard
          label="Average order"
          value={formatAfn(summary.avgOrderAfn, { unit: "suffix" })}
          caption={
            summary.lastOrderAt
              ? `last order ${formatRelative(summary.lastOrderAt)}`
              : "no orders yet"
          }
          icon={ReceiptTextIcon}
          accent="gold"
        />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[300px_1fr]">
        {/* Contact card ------------------------------------------------ */}
        <div className="space-y-4 xl:sticky xl:top-20">
          <Card>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="bg-brand-700 text-primary-foreground flex size-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                  {initials(client.name)}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium">{client.name}</p>
                  <p className="text-muted-foreground text-xs">
                    Prefers {CONTACT_CHANNEL_LABEL[client.preferredContact]}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2.5 text-sm">
                <a
                  href={`tel:${client.phone}`}
                  className="text-muted-foreground hover:text-foreground flex items-center gap-2.5"
                >
                  <PhoneIcon className="size-4 shrink-0" />
                  <span className="tabular">{client.phone}</span>
                  {sameWhatsapp && (
                    <span className="text-muted-foreground/70 ml-auto text-xs">
                      also WhatsApp
                    </span>
                  )}
                </a>
                {/* Only a *different* WhatsApp number earns its own line. */}
                {client.whatsapp && !sameWhatsapp && (
                  <a
                    href={`https://wa.me/${client.whatsapp.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground hover:text-foreground flex items-center gap-2.5"
                  >
                    <MessageCircleIcon className="size-4 shrink-0" />
                    <span className="tabular">{client.whatsapp}</span>
                  </a>
                )}
                {client.email && (
                  <a
                    href={`mailto:${client.email}`}
                    className="text-muted-foreground hover:text-foreground flex items-center gap-2.5 break-all"
                  >
                    <MailIcon className="size-4 shrink-0" />
                    {client.email}
                  </a>
                )}
                <div className="text-muted-foreground flex items-start gap-2.5">
                  <MapPinIcon className="mt-0.5 size-4 shrink-0" />
                  <span>
                    {client.address ? `${client.address}, ` : ""}
                    {client.city}
                  </span>
                </div>
              </div>

              {client.serviceFeePercent !== undefined && (
                <>
                  <Separator />
                  <div className="bg-muted/40 rounded-lg border px-3 py-2 text-sm">
                    <p className="text-muted-foreground text-xs">
                      Agreed service fee
                    </p>
                    <p className="tabular font-medium">
                      {client.serviceFeePercent}%
                    </p>
                  </div>
                </>
              )}

              {client.notes && (
                <>
                  <Separator />
                  <div>
                    <p className="text-muted-foreground mb-1 text-xs">Notes</p>
                    <p className="text-sm">{client.notes}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tabs -------------------------------------------------------- */}
        <div className="min-w-0">
          <Tabs defaultValue="orders">
            <TabsList>
              <TabsTrigger value="orders">
                Orders
                <span className="text-muted-foreground text-xs">
                  {orders.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="payments">
                Payments
                <span className="text-muted-foreground text-xs">
                  {payments.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="ledger">Statement</TabsTrigger>
            </TabsList>

            <TabsContent value="orders">
              <Card className="overflow-hidden py-0">
                {orders.length === 0 ? (
                  <EmptyState
                    icon={ShoppingCartIcon}
                    title="No orders yet"
                    description="This client has not requested anything so far."
                    action={
                      <Button size="sm" asChild>
                        <Link href="/orders/new">Create the first order</Link>
                      </Button>
                    }
                  />
                ) : (
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Order</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Total (AFN)</TableHead>
                        <TableHead className="text-right">Balance (AFN)</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map(({ order, economics }) => (
                        <TableRow key={order.id}>
                          <TableCell>
                            <Link
                              href={`/orders/${order.id}`}
                              className="tabular text-[13px] font-medium hover:underline"
                            >
                              {order.orderNo}
                            </Link>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-[13px]">
                            {order.items.length}
                          </TableCell>
                          <TableCell>
                            <StatusBadge kind="order" value={order.status} />
                          </TableCell>
                          <TableCell className="text-right">
                            <Money
                              value={economics.revenue.totalAfn}
                              className="text-[13px]"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Money
                              value={economics.balanceAfn}
                              zeroDash
                              className={cn(
                                "text-[13px]",
                                economics.balanceAfn > 0 && "text-destructive",
                              )}
                            />
                          </TableCell>
                          <TableCell className="text-muted-foreground tabular text-[13px]">
                            {formatDate(order.requestedAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="payments">
              <Card className="overflow-hidden py-0">
                {payments.length === 0 ? (
                  <EmptyState
                    icon={CreditCardIcon}
                    title="No payments recorded"
                    action={
                      <Button size="sm" onClick={() => setPaymentOpen(true)}>
                        Record the first payment
                      </Button>
                    }
                  />
                ) : (
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Receipt</TableHead>
                        <TableHead>Order</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Amount (AFN)</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map(({ payment, order, method }) => (
                        <TableRow key={payment.id}>
                          <TableCell className="tabular text-[13px] font-medium">
                            {payment.receiptNo}
                          </TableCell>
                          <TableCell>
                            {order ? (
                              <Link
                                href={`/orders/${order.id}`}
                                className="tabular text-[13px] hover:underline"
                              >
                                {order.orderNo}
                              </Link>
                            ) : (
                              <span className="text-muted-foreground text-xs">
                                on account
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-[13px]">
                            {method?.name ?? "—"}
                          </TableCell>
                          <TableCell>
                            <StatusBadge
                              kind="payment"
                              value={payment.type}
                              withDot={false}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Money
                              value={payment.amountAfn}
                              className="text-[13px] font-medium"
                            />
                          </TableCell>
                          <TableCell className="text-muted-foreground tabular text-[13px]">
                            {formatDate(payment.at)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon-xs" asChild>
                              <Link
                                href={`/print/receipt/${payment.id}`}
                                target="_blank"
                                aria-label="Print receipt"
                              >
                                <PrinterIcon />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="ledger">
              <Card className="overflow-hidden py-0">
                {ledger.length === 0 ? (
                  <EmptyState
                    icon={ReceiptTextIcon}
                    title="Nothing on the statement yet"
                    description="Orders and payments will appear here as a running balance."
                  />
                ) : (
                  <>
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow className="hover:bg-transparent">
                          <TableHead>Date</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Charged (AFN)</TableHead>
                          <TableHead className="text-right">Paid (AFN)</TableHead>
                          <TableHead className="text-right">Balance (AFN)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ledger.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell className="text-muted-foreground tabular text-[13px] whitespace-nowrap">
                              {formatDate(entry.at)}
                            </TableCell>
                            <TableCell>
                              <Link
                                href={entry.href}
                                className="text-[13px] hover:underline"
                              >
                                {entry.description}
                              </Link>
                            </TableCell>
                            <TableCell className="text-right">
                              {entry.debit > 0 ? (
                                <Money value={entry.debit} className="text-[13px]" />
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {entry.credit !== 0 ? (
                                <Money
                                  value={entry.credit}
                                  className="text-success text-[13px]"
                                />
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Money
                                value={entry.balance}
                                className={cn(
                                  "text-[13px] font-medium",
                                  entry.balance > 0
                                    ? "text-destructive"
                                    : "text-muted-foreground",
                                )}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="bg-muted/25 flex items-center justify-between border-t px-4 py-3 text-sm">
                      <span className="text-muted-foreground">
                        Closing balance
                      </span>
                      <Money
                        value={summary.balanceAfn}
                        className={cn(
                          "font-semibold",
                          summary.balanceAfn > 0
                            ? "text-destructive"
                            : "text-success",
                        )}
                      />
                    </div>
                  </>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <RecordPaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        clientId={client.id}
      />
    </>
  );
}
