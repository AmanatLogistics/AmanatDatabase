"use client";

import { SearchIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 pl-8 text-[13px]"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
        >
          <XIcon className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export interface FilterOption {
  value: string;
  label: string;
}

export function FilterSelect({
  value,
  onChange,
  options,
  allLabel,
  className,
  width = "w-[150px]",
}: {
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  allLabel: string;
  className?: string;
  width?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        size="sm"
        className={cn(width, "text-[13px]", value !== "all" && "border-primary/40", className)}
      >
        <SelectValue placeholder={allLabel} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export interface CountChip {
  value: string;
  label: string;
  count: number;
}

/**
 * Status sub-tabs with count chips, modelled on the reference billing screen:
 * `All 125 · Draft 2 · Outstanding 13 · Paid 100`.
 */
export function CountTabs({
  value,
  onChange,
  chips,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  chips: CountChip[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "scrollbar-thin flex items-center gap-1 overflow-x-auto pb-0.5",
        className,
      )}
    >
      {chips.map((chip) => {
        const active = chip.value === value;
        return (
          <button
            key={chip.value}
            type="button"
            onClick={() => onChange(chip.value)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {chip.label}
            <span
              className={cn(
                "tabular rounded px-1.5 py-0.5 text-[11px]",
                active
                  ? "bg-primary/15 text-primary"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {chip.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function ResetFiltersButton({
  show,
  onReset,
}: {
  show: boolean;
  onReset: () => void;
}) {
  if (!show) return null;
  return (
    <Button variant="ghost" size="sm" onClick={onReset} className="text-[13px]">
      <XIcon />
      Reset
    </Button>
  );
}
