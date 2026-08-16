import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface TimelineEntry {
  id: string;
  at: string;
  title: string;
  description?: string;
  /** Tailwind bg-* class for the node. */
  dot?: string;
  meta?: React.ReactNode;
}

/** Vertical event rail used by the order activity tab. */
export function Timeline({
  entries,
  className,
}: {
  entries: TimelineEntry[];
  className?: string;
}) {
  return (
    <ol className={cn("relative space-y-0", className)}>
      {entries.map((entry, index) => {
        const last = index === entries.length - 1;
        return (
          <li key={entry.id} className="relative flex gap-4 pb-6 last:pb-0">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "ring-background z-10 mt-1 size-2.5 shrink-0 rounded-full ring-4",
                  entry.dot ?? "bg-brand-600",
                )}
              />
              {!last && <span className="bg-border w-px flex-1" />}
            </div>

            <div className="-mt-0.5 min-w-0 flex-1 space-y-0.5 pb-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="text-sm font-medium">{entry.title}</span>
                {entry.meta}
              </div>
              {entry.description && (
                <p className="text-muted-foreground text-sm">
                  {entry.description}
                </p>
              )}
              <p className="text-muted-foreground/80 text-xs">
                {formatDateTime(entry.at)} · {formatRelative(entry.at)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
