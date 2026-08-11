import { CheckIcon } from "lucide-react";

import { ORDER_PIPELINE, ORDER_STATUS } from "@/lib/constants";
import type { OrderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Horizontal pipeline for an order. Terminal states (cancelled / refunded)
 * short-circuit the rail and render as a single warning line instead.
 */
export function OrderStatusStepper({
  status,
  className,
}: {
  status: OrderStatus;
  className?: string;
}) {
  if (status === "cancelled" || status === "refunded") {
    const meta = ORDER_STATUS[status];
    return (
      <div
        className={cn(
          "border-destructive/25 bg-destructive/5 text-destructive flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
          className,
        )}
      >
        <span className={cn("size-2 rounded-full", meta.dot)} />
        This order was {meta.label.toLowerCase()} and is no longer in the pipeline.
      </div>
    );
  }

  const currentIndex = ORDER_PIPELINE.indexOf(status);

  return (
    <ol
      className={cn(
        "scrollbar-thin flex items-center gap-0 overflow-x-auto pb-1",
        className,
      )}
    >
      {ORDER_PIPELINE.map((step, index) => {
        const done = index < currentIndex;
        const current = index === currentIndex;
        const meta = ORDER_STATUS[step];

        return (
          <li key={step} className="flex shrink-0 items-center">
            <div className="flex flex-col items-center gap-1.5 px-1">
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full border text-[10px] font-semibold transition-colors",
                  done && "bg-primary border-primary text-primary-foreground",
                  current &&
                    "border-primary text-primary ring-primary/20 bg-background ring-4",
                  !done && !current && "border-border text-muted-foreground",
                )}
              >
                {done ? <CheckIcon className="size-3" /> : index + 1}
              </span>
              <span
                className={cn(
                  "max-w-[74px] text-center text-[10.5px] leading-tight",
                  current
                    ? "text-foreground font-medium"
                    : "text-muted-foreground",
                )}
              >
                {meta.label}
              </span>
            </div>
            {index < ORDER_PIPELINE.length - 1 && (
              <span
                className={cn(
                  "-mt-5 h-px w-6 sm:w-9",
                  index < currentIndex ? "bg-primary" : "bg-border",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
