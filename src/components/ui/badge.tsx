import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 [&>svg]:pointer-events-none transition-colors overflow-hidden",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive:
          "border-transparent bg-destructive/10 text-destructive dark:bg-destructive/20",
        outline: "text-foreground",
        success:
          "border-transparent bg-success/12 text-success dark:bg-success/20",
        warning:
          "border-transparent bg-warning/15 text-warning-foreground dark:bg-warning/20 dark:text-warning",
        info: "border-transparent bg-info/12 text-info dark:bg-info/20",
        muted: "border-transparent bg-muted text-muted-foreground",
        brand: "border-transparent bg-brand-700/10 text-brand-700 dark:bg-brand-400/15 dark:text-brand-300",
        gold: "border-transparent bg-gold-500/15 text-gold-800 dark:bg-gold-400/15 dark:text-gold-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
