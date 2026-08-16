"use client";

import * as React from "react";
import Link from "next/link";
import { StoreIcon } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Money } from "@/components/shared/money";
import { ProductThumb } from "@/components/shared/product-thumb";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { usePublishedProducts } from "@/lib/api";
import { PRODUCT_CATEGORY_LABEL } from "@/lib/constants";
import { useStoreHydrated } from "@/lib/hydration";
import { cn } from "@/lib/utils";

/** The shop window. Only published products ever reach here. */
export function StorefrontScreen() {
  const hydrated = useStoreHydrated();
  const products = usePublishedProducts();
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState<string>("all");

  const categories = React.useMemo(
    () => Array.from(new Set(products.map((p) => p.category))).sort(),
    [products],
  );

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
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Shop
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Order it here, we buy it and bring it to Kabul, you collect it.
        </p>
      </div>

      <div className="mb-5 flex flex-col gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products…"
          className="h-11"
        />
        <div className="scrollbar-thin flex gap-1.5 overflow-x-auto pb-1">
          <CategoryChip
            active={category === "all"}
            onClick={() => setCategory("all")}
          >
            All
          </CategoryChip>
          {categories.map((c) => (
            <CategoryChip
              key={c}
              active={category === c}
              onClick={() => setCategory(c)}
            >
              {PRODUCT_CATEGORY_LABEL[c]}
            </CategoryChip>
          ))}
        </div>
      </div>

      {hydrated && filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={StoreIcon}
            title="Nothing to show"
            description="No products match what you are looking for."
          />
        </Card>
      ) : (
        <div
          className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4"
          data-testid="product-grid"
        >
          {filtered.map((product) => (
            <Link key={product.id} href={`/store/p/${product.slug}`}>
              <Card className="hover:border-brand-600/40 h-full transition-colors">
                <CardContent className="flex h-full flex-col gap-2 pt-6">
                  <ProductThumb
                    size="lg"
                    category={product.category}
                    name={product.name}
                    imageUrl={product.imageUrl}
                    className="w-full"
                  />
                  <p className="line-clamp-2 text-sm font-medium">
                    {product.name}
                  </p>
                  <div className="mt-auto">
                    <Money
                      value={product.priceAfn}
                      unit="suffix"
                      className="font-semibold"
                    />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors",
        active
          ? "border-brand-600 bg-brand-700 text-primary-foreground"
          : "hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}
