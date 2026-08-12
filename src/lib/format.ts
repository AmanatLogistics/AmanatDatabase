import { format, formatDistanceToNowStrict, isValid, parseISO } from "date-fns";

import type { ISODate } from "@/lib/types";

/* -------------------------------------------------------------------------- */
/* Money                                                                       */
/* -------------------------------------------------------------------------- */

const afnFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const usdFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Afghani amounts.
 *
 * The Afghani sign (؋, U+060B) is an Arabic-script glyph: next to Latin digits
 * it renders small and off-baseline, and repeating it in every table cell reads
 * as a rendering artifact. So amounts are formatted as bare grouped digits and
 * the unit is carried by the column header — "Total (AFN)" — the way finance
 * software normally does it.
 *
 * Pass `unit: "suffix"` for standalone figures (KPI tiles, invoice totals) that
 * have no column header to lean on: "148,500 AFN".
 */
export function formatAfn(
  amount: number,
  opts: { sign?: boolean; unit?: "none" | "suffix" } = {},
): string {
  const { sign = false, unit = "none" } = opts;
  const abs = Math.abs(Math.round(amount));
  const body = afnFormatter.format(abs);
  const prefix = amount < 0 ? "−" : sign ? "+" : "";
  return unit === "suffix" ? `${prefix}${body} AFN` : `${prefix}${body}`;
}

/** "$1,249.99" — what we actually paid the store. */
export function formatUsd(amount: number, opts: { sign?: boolean } = {}): string {
  const abs = Math.abs(amount);
  const prefix = amount < 0 ? "−" : opts.sign ? "+" : "";
  return `${prefix}$${usdFormatter.format(abs)}`;
}

/** Compact axis/KPI form: "1.2M", "840k". Unit-less — axes carry it in the title. */
export function formatAfnCompact(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000)}k`;
  return `${sign}${Math.round(abs)}`;
}

export function formatPercent(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

export function formatNumber(value: number): string {
  return afnFormatter.format(value);
}

/* -------------------------------------------------------------------------- */
/* Dates                                                                       */
/* -------------------------------------------------------------------------- */

function toDate(value: ISODate | Date | undefined | null): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : parseISO(value);
  return isValid(date) ? date : null;
}

/** "14 Jul 2026" */
export function formatDate(value?: ISODate | Date | null): string {
  const date = toDate(value);
  return date ? format(date, "d MMM yyyy") : "—";
}

/** "14 Jul 2026, 09:12" */
export function formatDateTime(value?: ISODate | Date | null): string {
  const date = toDate(value);
  return date ? format(date, "d MMM yyyy, HH:mm") : "—";
}

/** "14 Jul" — for dense table columns. */
export function formatDateShort(value?: ISODate | Date | null): string {
  const date = toDate(value);
  return date ? format(date, "d MMM") : "—";
}

/** "3 days ago" / "in 5 days" */
export function formatRelative(value?: ISODate | Date | null): string {
  const date = toDate(value);
  if (!date) return "—";
  return formatDistanceToNowStrict(date, { addSuffix: true });
}

/** "Jul 2026" — month buckets on charts. */
export function formatMonth(value?: ISODate | Date | null): string {
  const date = toDate(value);
  return date ? format(date, "MMM yyyy") : "—";
}

/** Whole days between two instants; negative when `to` is in the past. */
export function daysBetween(from: ISODate | Date, to: ISODate | Date): number {
  const a = toDate(from);
  const b = toDate(to);
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/* -------------------------------------------------------------------------- */
/* Text                                                                        */
/* -------------------------------------------------------------------------- */

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** "amazon.com" from a full product URL. */
export function hostnameOf(url?: string): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
