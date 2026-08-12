"use client";

import * as React from "react";
import { toast } from "sonner";
import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Money } from "@/components/shared/money";
import { CHART_COLORS } from "@/lib/constants";
import {
  upsertExpenseCategory,
  useExpenseCategories,
  useExpenseRows,
} from "@/lib/api";
import type { ExpenseCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ExpenseCategoriesSettingsScreen() {
  const categories = useExpenseCategories();
  const expenses = useExpenseRows();

  const [editing, setEditing] = React.useState<ExpenseCategory | null>(null);
  const [creating, setCreating] = React.useState(false);

  const usage = React.useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    expenses.forEach((row) => {
      const current = map.get(row.expense.categoryId) ?? { count: 0, total: 0 };
      current.count += 1;
      current.total += row.expense.amountAfn;
      map.set(row.expense.categoryId, current);
    });
    return map;
  }, [expenses]);

  return (
    <>
      <Card className="overflow-hidden py-0">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm">Expense categories</CardTitle>
              <p className="text-muted-foreground text-xs">
                Used to group operating costs on the profit &amp; loss statement.
              </p>
            </div>
            <Button size="sm" onClick={() => setCreating(true)}>
              <PlusIcon />
              Add category
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-0 pt-3 pb-0">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Entries</TableHead>
                <TableHead className="text-right">Total spent</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((category) => {
                const stats = usage.get(category.id);
                return (
                  <TableRow key={category.id}>
                    <TableCell>
                      <span className="flex items-center gap-2.5 text-[13px] font-medium">
                        <span
                          className="size-3 shrink-0 rounded-full"
                          style={{ backgroundColor: category.color }}
                        />
                        {category.name}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-xs text-xs">
                      {category.description ?? "—"}
                    </TableCell>
                    <TableCell className="tabular text-right text-[13px]">
                      {stats?.count ?? 0}
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={stats?.total ?? 0} className="text-[13px]" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => setEditing(category)}
                      >
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CategoryDialog
        open={creating || !!editing}
        category={editing}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false);
            setEditing(null);
          }
        }}
      />
    </>
  );
}

function CategoryDialog({
  open,
  category,
  onOpenChange,
}: {
  open: boolean;
  category: ExpenseCategory | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {category ? "Edit category" : "Add expense category"}
          </DialogTitle>
          <DialogDescription>
            A bucket for operating costs on the P&amp;L.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <CategoryForm category={category} onDone={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CategoryForm({
  category,
  onDone,
}: {
  category: ExpenseCategory | null;
  onDone: () => void;
}) {
  const [name, setName] = React.useState(category?.name ?? "");
  const [description, setDescription] = React.useState(
    category?.description ?? "",
  );
  const [color, setColor] = React.useState(category?.color ?? CHART_COLORS[0]);
  const [saving, setSaving] = React.useState(false);

  const invalid = !name.trim();

  async function handleSubmit() {
    if (invalid) return;
    setSaving(true);
    try {
      await upsertExpenseCategory({
        id: category?.id ?? `exp-${name.toLowerCase().replace(/\W+/g, "-")}`,
        name: name.trim(),
        description: description.trim() || undefined,
        color,
      });
      toast.success(category ? "Category updated" : "Category added");
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="category-name">Name</Label>
            <Input
              id="category-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Vehicle & fuel"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="category-description">Description (optional)</Label>
            <Textarea
              id="category-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="What belongs in this category."
            />
          </div>
          <div className="grid gap-2">
            <Label>Chart colour</Label>
            <div className="flex flex-wrap gap-2">
              {CHART_COLORS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setColor(option)}
                  aria-label={`Colour ${option}`}
                  className={cn(
                    "size-8 rounded-full border-2 transition-transform",
                    color === option
                      ? "border-foreground scale-110"
                      : "border-transparent",
                  )}
                  style={{ backgroundColor: option }}
                />
              ))}
            </div>
          </div>
        </div>

      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={invalid || saving}>
          {saving ? "Saving…" : category ? "Save category" : "Add category"}
        </Button>
      </DialogFooter>
    </>
  );
}
