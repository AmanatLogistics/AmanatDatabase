import { formatAfn, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * AFN amount. Positive/negative colouring is opt-in so ordinary totals stay
 * neutral and only profit/balance columns carry meaning.
 */
export function Money({
  value,
  className,
  tone = "plain",
  sign = false,
  symbol = true,
}: {
  value: number;
  className?: string;
  /** "plain" = inherit, "signed" = green/red by sign, "muted" = de-emphasised. */
  tone?: "plain" | "signed" | "muted";
  sign?: boolean;
  symbol?: boolean;
}) {
  return (
    <span
      className={cn(
        "tabular whitespace-nowrap",
        tone === "signed" &&
          (value > 0
            ? "text-success"
            : value < 0
              ? "text-destructive"
              : "text-muted-foreground"),
        tone === "muted" && "text-muted-foreground",
        className,
      )}
    >
      {formatAfn(value, { sign, symbol })}
    </span>
  );
}

/** USD amount — what we actually paid a store or forwarder. */
export function MoneyUsd({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  return (
    <span className={cn("tabular whitespace-nowrap", className)}>
      {formatUsd(value)}
    </span>
  );
}

/** Percentage change pill used on KPI cards. */
export function DeltaPill({
  value,
  className,
  suffix = "vs last month",
}: {
  value: number | null;
  className?: string;
  suffix?: string;
}) {
  if (value === null) {
    return (
      <span
        className={cn(
          "bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-medium",
          className,
        )}
      >
        new
      </span>
    );
  }

  const positive = value >= 0;

  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-medium tabular",
        positive
          ? "bg-success/12 text-success"
          : "bg-destructive/10 text-destructive",
        className,
      )}
      title={`${value >= 0 ? "+" : ""}${value.toFixed(1)}% ${suffix}`}
    >
      {positive ? "+" : "−"}
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}
