import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { DeltaPill } from "@/components/shared/money";
import { cn } from "@/lib/utils";

/**
 * The dashboard KPI card: label + delta pill, big figure, caption, thin bar.
 * Modelled on the reference dashboard's top row.
 */
export function StatCard({
  label,
  value,
  caption,
  delta,
  deltaSuffix,
  progress,
  accent = "brand",
  icon: Icon,
  className,
}: {
  label: string;
  value: React.ReactNode;
  caption?: React.ReactNode;
  delta?: number | null;
  deltaSuffix?: string;
  /** 0-100 */
  progress?: number;
  accent?: "brand" | "gold" | "info" | "success" | "destructive";
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  const bar = {
    brand: "bg-brand-600",
    gold: "bg-gold-500",
    info: "bg-info",
    success: "bg-success",
    destructive: "bg-destructive",
  }[accent];

  const tint = {
    brand: "bg-brand-700/10 text-brand-700 dark:bg-brand-400/15 dark:text-brand-300",
    gold: "bg-gold-500/15 text-gold-700 dark:text-gold-400",
    info: "bg-info/12 text-info",
    success: "bg-success/12 text-success",
    destructive: "bg-destructive/10 text-destructive",
  }[accent];

  return (
    <Card className={cn("gap-0 p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {Icon && (
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-md",
                tint,
              )}
            >
              <Icon className="size-4" />
            </span>
          )}
          <span className="text-muted-foreground text-[13px] font-medium">
            {label}
          </span>
        </div>
        {delta !== undefined && (
          <DeltaPill value={delta} suffix={deltaSuffix ?? "vs last month"} />
        )}
      </div>

      <div className="mt-3 text-[26px] leading-none font-semibold tracking-tight tabular">
        {value}
      </div>

      {caption && (
        <div className="text-muted-foreground mt-2 flex items-center gap-1.5 text-xs">
          {caption}
        </div>
      )}

      {progress !== undefined && (
        <Progress
          value={Math.max(3, Math.min(100, progress))}
          className="mt-3.5 h-1"
          indicatorClassName={bar}
        />
      )}
    </Card>
  );
}
