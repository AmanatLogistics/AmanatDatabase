"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { PlusIcon, ReceiptTextIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/shared/data-table";
import {
  CountTabs,
  FilterSelect,
  ResetFiltersButton,
  SearchInput,
} from "@/components/shared/filter-bar";
import { Money } from "@/components/shared/money";
import { PageHeader } from "@/components/shared/page-header";
import {
  createExpense,
  useExpenseCategories,
  useExpenseRows,
  usePaymentMethods,
  useToday,
  type ExpenseRow,
} from "@/lib/api";
import { formatAfn, formatDate } from "@/lib/format";

export function ExpensesScreen() {
  const rows = useExpenseRows();
  const categories = useExpenseCategories();
  const methods = usePaymentMethods().filter((m) => m.usedFor !== "incoming");
  const today = useToday();

  const [tab, setTab] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [method, setMethod] = React.useState("all");
  const [addOpen, setAddOpen] = React.useState(false);

  const chips = React.useMemo(
    () => [
      { value: "all", label: "All", count: rows.length },
      ...categories.map((category) => ({
        value: category.id,
        label: category.name,
        count: rows.filter((r) => r.expense.categoryId === category.id).length,
      })),
    ],
    [rows, categories],
  );

  const filtered = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter(({ expense, category }) => {
      if (tab !== "all" && expense.categoryId !== tab) return false;
      if (method !== "all" && expense.methodId !== method) return false;
      if (query) {
        const haystack =
          `${expense.description} ${expense.vendor ?? ""} ${category?.name ?? ""} ${expense.receiptRef ?? ""}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [rows, tab, search, method]);

  const stats = React.useMemo(() => {
    const monthStart = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1),
    ).getTime();
    const yearStart = new Date(
      Date.UTC(today.getUTCFullYear(), 0, 1),
    ).getTime();
    return {
      month: rows
        .filter((r) => new Date(r.expense.at).getTime() >= monthStart)
        .reduce((sum, r) => sum + r.expense.amountAfn, 0),
      year: rows
        .filter((r) => new Date(r.expense.at).getTime() >= yearStart)
        .reduce((sum, r) => sum + r.expense.amountAfn, 0),
      filtered: filtered.reduce((sum, r) => sum + r.expense.amountAfn, 0),
    };
  }, [rows, filtered, today]);

  const columns = React.useMemo<ColumnDef<ExpenseRow, unknown>[]>(
    () => [
      {
        id: "at",
        meta: "Date",
        accessorFn: (row) => row.expense.at,
        header: "Date",
        cell: ({ row }) => (
          <span className="tabular text-[13px] whitespace-nowrap">
            {formatDate(row.original.expense.at)}
          </span>
        ),
      },
      {
        id: "description",
        meta: "Description",
        accessorFn: (row) => row.expense.description,
        header: "Description",
        cell: ({ row }) => {
          const { expense } = row.original;
          return (
            <div className="min-w-0">
              <p className="text-[13px]">{expense.description}</p>
              {expense.vendor && (
                <p className="text-muted-foreground text-xs">{expense.vendor}</p>
              )}
            </div>
          );
        },
      },
      {
        id: "category",
        meta: "Category",
        accessorFn: (row) => row.category?.name ?? "",
        header: "Category",
        cell: ({ row }) => {
          const { category } = row.original;
          if (!category) return <span className="text-muted-foreground">—</span>;
          return (
            <span className="flex items-center gap-2 text-[13px]">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: category.color }}
              />
              {category.name}
            </span>
          );
        },
      },
      {
        id: "method",
        meta: "Paid with",
        accessorFn: (row) => row.method?.name ?? "",
        header: "Paid with",
        cell: ({ row }) => (
          <span className="text-muted-foreground text-[13px]">
            {row.original.method?.name ?? "—"}
          </span>
        ),
      },
      {
        id: "receipt",
        meta: "Receipt ref",
        enableSorting: false,
        accessorFn: (row) => row.expense.receiptRef ?? "",
        header: "Receipt",
        cell: ({ row }) => (
          <span className="text-muted-foreground tabular text-xs">
            {row.original.expense.receiptRef ?? "—"}
          </span>
        ),
      },
      {
        id: "amount",
        meta: "Amount",
        accessorFn: (row) => row.expense.amountAfn,
        header: "Amount",
        cell: ({ row }) => (
          <Money
            value={row.original.expense.amountAfn}
            className="text-[13px] font-medium"
          />
        ),
      },
    ],
    [],
  );

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Finance", href: "/finance" },
          { label: "Expenses" },
        ]}
        title="Operating expenses"
        description="Rent, salaries, freight overhead and everything else that is not the cost of a client's goods."
        actions={
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <PlusIcon />
            Add expense
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-muted-foreground text-[13px]">This month</p>
          <p className="tabular mt-1 text-xl font-semibold">
            {formatAfn(stats.month)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-muted-foreground text-[13px]">
            Year to date {today.getUTCFullYear()}
          </p>
          <p className="tabular mt-1 text-xl font-semibold">
            {formatAfn(stats.year)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-muted-foreground text-[13px]">Filtered total</p>
          <p className="tabular mt-1 text-xl font-semibold">
            {formatAfn(stats.filtered)}
          </p>
        </Card>
      </div>

      <CountTabs value={tab} onChange={setTab} chips={chips} />

      <DataTable
        columns={columns}
        data={filtered}
        entityName="expenses"
        exportFileName="amanat-expenses"
        initialSorting={[{ id: "at", desc: true }]}
        emptyIcon={ReceiptTextIcon}
        emptyTitle="No expenses match these filters"
        toolbar={
          <>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search description or vendor…"
              className="w-full sm:w-64"
            />
            <FilterSelect
              value={method}
              onChange={setMethod}
              allLabel="All methods"
              width="w-[180px]"
              options={methods.map((m) => ({ value: m.id, label: m.name }))}
            />
            <ResetFiltersButton
              show={search !== "" || method !== "all"}
              onReset={() => {
                setSearch("");
                setMethod("all");
              }}
            />
          </>
        }
      />

      <AddExpenseDialog open={addOpen} onOpenChange={setAddOpen} />
    </>
  );
}

function AddExpenseDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add expense</DialogTitle>
          <DialogDescription>
            Money out that is not the cost of a specific client order.
          </DialogDescription>
        </DialogHeader>
        {open && <ExpenseForm onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function ExpenseForm({ onDone }: { onDone: () => void }) {
  const categories = useExpenseCategories();
  const methods = usePaymentMethods().filter((m) => m.usedFor !== "incoming");

  const [categoryId, setCategoryId] = React.useState(categories[0]?.id ?? "");
  const [description, setDescription] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [methodId, setMethodId] = React.useState(methods[0]?.id ?? "pm-cash");
  const [vendor, setVendor] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const invalid = !categoryId || !description.trim() || Number(amount) <= 0;

  async function handleSubmit() {
    if (invalid) return;
    setSaving(true);
    try {
      await createExpense({
        categoryId,
        description: description.trim(),
        amountAfn: Number(amount),
        methodId,
        vendor: vendor.trim() || undefined,
      });
      toast.success("Expense recorded", {
        description: "Net profit has been recalculated.",
      });
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="expense-category">Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger id="expense-category" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="expense-description">Description</Label>
            <Input
              id="expense-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Shop rent — August 2026"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="expense-amount">Amount (AFN)</Label>
              <Input
                id="expense-amount"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
                className="tabular"
                placeholder="0"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="expense-method">Paid with</Label>
              <Select value={methodId} onValueChange={setMethodId}>
                <SelectTrigger id="expense-method" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {methods.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="expense-vendor">Vendor (optional)</Label>
            <Input
              id="expense-vendor"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="Zarnegar Plaza management"
            />
          </div>
        </div>

      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={invalid || saving}>
          {saving ? "Saving…" : "Add expense"}
        </Button>
      </DialogFooter>
    </>
  );
}
