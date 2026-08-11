import {
  BabyIcon,
  CarIcon,
  HeartPulseIcon,
  LaptopIcon,
  PackageIcon,
  ShirtIcon,
  SmartphoneIcon,
  SofaIcon,
  SparklesIcon,
  ZapIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { ProductCategory } from "@/lib/types";

const CATEGORY_ICON: Record<
  ProductCategory,
  React.ComponentType<{ className?: string }>
> = {
  mobile: SmartphoneIcon,
  computers: LaptopIcon,
  electronics: ZapIcon,
  beauty: SparklesIcon,
  health: HeartPulseIcon,
  baby: BabyIcon,
  fashion: ShirtIcon,
  home: SofaIcon,
  auto: CarIcon,
  other: PackageIcon,
};

/** Deterministic tint per category so a product looks the same everywhere. */
const CATEGORY_TINT: Record<ProductCategory, string> = {
  mobile: "from-chart-3/18 to-chart-3/5 text-chart-3",
  computers: "from-chart-4/18 to-chart-4/5 text-chart-4",
  electronics: "from-chart-5/18 to-chart-5/5 text-chart-5",
  beauty: "from-chart-1/18 to-chart-1/5 text-chart-1",
  health: "from-chart-4/18 to-chart-4/5 text-chart-4",
  baby: "from-chart-6/20 to-chart-6/5 text-chart-6",
  fashion: "from-chart-5/18 to-chart-5/5 text-chart-5",
  home: "from-chart-2/22 to-chart-2/5 text-gold-700 dark:text-gold-400",
  auto: "from-chart-3/18 to-chart-3/5 text-chart-3",
  other: "from-muted to-muted text-muted-foreground",
};

/**
 * Product image with a branded fallback.
 *
 * The mock dataset carries no photography, so every item renders the category
 * tile. Once the backend supplies `imageUrl` values (client photos or store
 * images), they render here instead — add the host to `next.config.ts`.
 */
export function ProductThumb({
  category,
  imageUrl,
  name,
  className,
  size = "md",
}: {
  category: ProductCategory;
  imageUrl?: string;
  name: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const Icon = CATEGORY_ICON[category];
  const sizing =
    size === "sm" ? "size-9 rounded-md" : size === "lg" ? "size-16 rounded-xl" : "size-11 rounded-lg";
  const iconSizing = size === "sm" ? "size-4" : size === "lg" ? "size-7" : "size-5";

  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={name}
        className={cn("border object-cover", sizing, className)}
      />
    );
  }

  return (
    <span
      aria-hidden
      title={name}
      className={cn(
        "flex shrink-0 items-center justify-center border bg-gradient-to-br",
        CATEGORY_TINT[category],
        sizing,
        className,
      )}
    >
      <Icon className={iconSizing} />
    </span>
  );
}
