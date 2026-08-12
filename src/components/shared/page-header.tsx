import { cn } from "@/lib/utils";

/**
 * The strip between the top bar and the page content.
 *
 * It deliberately carries no heading and no breadcrumb: the top bar owns the
 * page identity now, so repeating the title here would print it twice and push
 * the actual content below the fold. What is left is the one-line description,
 * any status chips that belong to the record, and the page's actions.
 */
export function PageHeader({
  description,
  actions,
  meta,
  className,
}: {
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** Small chips describing the record, e.g. status or an entity count. */
  meta?: React.ReactNode;
  className?: string;
}) {
  if (!description && !actions && !meta) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-4 gap-y-2",
        className,
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
        {description && (
          <p className="text-muted-foreground max-w-2xl text-sm">
            {description}
          </p>
        )}
        {meta}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}
