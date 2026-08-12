import { formatAfn } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * An Afghani amount.
 *
 * By default it renders bare grouped digits — the unit belongs in the column
 * header ("Total (AFN)"), not repeated in every cell. Standalone figures with no
 * header to lean on pass `unit="suffix"` to get "148,500 AFN".
 */
export function Money({
  value,
  className,
  tone = "plain",
  sign = false,
  unit = "none",
  zeroDash = false,
}: {
  value: number;
  className?: string;
  /** "plain" = inherit, "signed" = green/red by sign, "muted" = de-emphasised. */
  tone?: "plain" | "signed" | "muted";
  sign?: boolean;
  unit?: "none" | "suffix";
  /** Render an em dash instead of a lone "0" — keeps sparse columns quiet. */
  zeroDash?: boolean;
}) {
  if (zeroDash && Math.round(value) === 0) {
    return <span className={cn("text-muted-foreground/50", className)}>—</span>;
  }

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
      {formatAfn(value, { sign, unit })}
    </span>
  );
}

/** Percentage-change pill used on KPI cards. */
export function DeltaPill({
  value,
  className,
  suffix = "vs last month",
  goodWhenDown = false,
}: {
  value: number | null;
  className?: string;
  suffix?: string;
  /**
   * For metrics where growth is bad news — cost, money owed to us — a rise must
   * not be painted green just because the number went up.
   */
  goodWhenDown?: boolean;
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

  const good = goodWhenDown ? value <= 0 : value >= 0;

  return (
    <span
      className={cn(
        "tabular rounded-full px-2 py-0.5 text-[11px] font-medium",
        good
          ? "bg-success/12 text-success"
          : "bg-destructive/10 text-destructive",
        className,
      )}
      title={`${value >= 0 ? "+" : ""}${value.toFixed(1)}% ${suffix}`}
    >
      {value >= 0 ? "+" : "−"}
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}
