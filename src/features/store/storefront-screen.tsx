"use client";

import * as React from "react";
import Link from "next/link";
import { SearchIcon, StoreIcon, TruckIcon } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Money } from "@/components/shared/money";
import { ProductThumb } from "@/components/shared/product-thumb";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { usePublishedProducts } from "@/lib/api";
import { PRODUCT_CATEGORY_LABEL } from "@/lib/constants";
import { useStoreHydrated } from "@/lib/hydration";
import { cn } from "@/lib/utils";
import type { StoreProduct } from "@/lib/types";

/**
 * The shop window.
 *
 * Laid out the way a marketplace is, because that is what customers already
 * know how to read: a category rail across the top, then a dense grid of
 * image-first cards with the price as the loudest thing on each. Two columns on
 * a phone, up to five on a desktop — a shop should feel full, and one product
 * per row makes a catalogue look empty.
 *
 * Only published products ever reach here.
 */
export function StorefrontScreen() {
  const hydrated = useStoreHydrated();
  const products = usePublishedProducts();
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState<string>("all");

  const categories = React.useMemo(() => {
    const counts = new Map<string, number>();
    products.forEach((p) =>
      counts.set(p.category, (counts.get(p.category) ?? 0) + 1),
    );
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [products]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (q && !`${p.name} ${p.description}`.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [products, search, category]);

  return (
    <>
      {/* A banner, so the shop opens with something rather than a bare grid. */}
      <div className="brand-gradient text-primary-foreground mb-5 rounded-xl px-5 py-6 sm:px-8 sm:py-10">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Anything you want, brought to Kabul
        </h1>
        <p className="text-primary-foreground/85 mt-1.5 max-w-lg text-sm">
          Order here, we buy it from the store for you, and you collect it from
          our office. Pay when you collect.
        </p>
        <div className="mt-4 flex flex-wrap gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <TruckIcon className="size-4" />
            Usually 2–3 weeks
          </span>
          <span className="flex items-center gap-1.5">
            <StoreIcon className="size-4" />
            Collect in Shahr-e-Naw
          </span>
        </div>
      </div>

      {/* Search sits above the rail, the way a marketplace puts it. */}
      <div className="relative mb-4">
        <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search for a product…"
          className="h-12 pl-9"
          aria-label="Search products"
        />
      </div>

      <div className="scrollbar-thin mb-5 flex gap-2 overflow-x-auto pb-1">
        <CategoryChip
          active={category === "all"}
          onClick={() => setCategory("all")}
          count={products.length}
        >
          All
        </CategoryChip>
        {categories.map(([c, count]) => (
          <CategoryChip
            key={c}
            active={category === c}
            onClick={() => setCategory(c)}
            count={count}
          >
            {PRODUCT_CATEGORY_LABEL[c as StoreProduct["category"]]}
          </CategoryChip>
        ))}
      </div>

      {!hydrated ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={StoreIcon}
            title="Nothing to show"
            description="No products match what you are looking for. Try a different search or category."
          />
        </Card>
      ) : (
        <>
          <p className="text-muted-foreground mb-3 text-xs">
            {filtered.length} product{filtered.length > 1 ? "s" : ""}
          </p>
          <div
            className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
            data-testid="product-grid"
          >
            {filtered.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

/** Image first, name second, price loudest — the marketplace convention. */
function ProductCard({ product }: { product: StoreProduct }) {
  return (
    <Link href={`/store/p/${product.slug}`} className="group">
      <article className="bg-card hover:border-brand-600/40 flex h-full flex-col overflow-hidden rounded-xl border transition-all hover:shadow-md">
        <div className="bg-muted/30 aspect-square overflow-hidden">
          <ProductThumb
            size="lg"
            category={product.category}
            name={product.name}
            imageUrl={product.imageUrls[0]}
            className="size-full rounded-none border-0 transition-transform duration-200 group-hover:scale-[1.03]"
          />
        </div>
        <div className="flex flex-1 flex-col gap-1 p-2.5">
          <p className="line-clamp-2 text-[13px] leading-snug">{product.name}</p>
          <div className="mt-auto pt-1">
            <Money
              value={product.priceAfn}
              unit="suffix"
              className="text-brand-700 dark:text-brand-300 text-[15px] font-bold"
            />
          </div>
        </div>
      </article>
    </Link>
  );
}

function CategoryChip({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs transition-colors",
        active
          ? "border-brand-600 bg-brand-700 text-primary-foreground"
          : "hover:bg-muted",
      )}
    >
      {children}
      <span className={cn("text-[10px]", active ? "opacity-75" : "text-muted-foreground")}>
        {count}
      </span>
    </button>
  );
}
