"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ImagesIcon,
  PackageCheckIcon,
  SearchIcon,
  StoreIcon,
  TruckIcon,
  WalletIcon,
  XIcon,
} from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Money } from "@/components/shared/money";
import { ProductThumb } from "@/components/shared/product-thumb";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWhereWeAre } from "@/lib/api";
import { PRODUCT_CATEGORY_LABEL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { ProductCategory, PublicProduct } from "@/lib/types";

/**
 * The shop window.
 *
 * The catalogue is rendered by the server and arrives as a prop. It used to be
 * read from the visitor's own browser storage, which meant a customer saw the
 * shop as it looked on the machine that created it — for anyone else, empty.
 *
 * Laid out the way a marketplace is, because that is what customers already
 * know how to read: a hero that says what we actually do, a search-and-sort bar
 * that stays put as you scroll, a category rail, then a dense grid of
 * image-first cards with the price as the loudest thing on each. Two columns on
 * a phone, up to five on a desktop — a shop should feel full, and one product
 * per row makes a catalogue look empty.
 *
 * Only published products ever reach here.
 */

type Sort = "new" | "price_asc" | "price_desc" | "name";

const SORT_LABEL: Record<Sort, string> = {
  new: "Newest first",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
  name: "Name: A to Z",
};

export function StorefrontScreen({ products }: { products: PublicProduct[] }) {
  const params = useSearchParams();
  const [search, setSearch] = React.useState("");
  /*
   * `?category=` is read once, when the screen mounts. It is how the product
   * page's breadcrumb gets back to a category, and it makes a filtered shop
   * something a customer can send to someone. Clicking a chip afterwards is a
   * local change and deliberately does not push history — nobody wants twelve
   * back-button presses to leave a shop.
   */
  const [category, setCategory] = React.useState<string>(
    () => params.get("category") ?? "all",
  );
  const [sort, setSort] = React.useState<Sort>("new");

  const categories = React.useMemo(() => {
    const counts = new Map<string, number>();
    products.forEach((p) =>
      counts.set(p.category, (counts.get(p.category) ?? 0) + 1),
    );
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [products]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const matches = products.filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (q && !`${p.name} ${p.description}`.toLowerCase().includes(q))
        return false;
      return true;
    });

    // Sorted on a copy — `products` comes straight from the store.
    return [...matches].sort((a, b) => {
      switch (sort) {
        case "price_asc":
          return a.priceAfn - b.priceAfn;
        case "price_desc":
          return b.priceAfn - a.priceAfn;
        case "name":
          return a.name.localeCompare(b.name);
        default:
          return b.createdAt.localeCompare(a.createdAt);
      }
    });
  }, [products, search, category, sort]);

  const narrowed = category !== "all" || search.trim() !== "";

  return (
    <>
      <Hero />

      {/*
       * Search and sort stay visible while the grid scrolls under them — on a
       * long catalogue, scrolling back to the top to change a filter is the
       * thing that makes a shop feel like a spreadsheet.
       */}
      <div className="bg-background/95 sticky top-14 z-20 -mx-4 mb-4 border-b px-4 py-3 backdrop-blur sm:top-16">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search for a product…"
              className="h-11 pl-9"
              aria-label="Search products"
            />
            {search && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearch("")}
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded p-1"
              >
                <XIcon className="size-4" />
              </button>
            )}
          </div>
          <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
            <SelectTrigger
              className="h-11 w-[9.5rem] shrink-0 sm:w-[11.5rem]"
              aria-label="Sort products"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {(Object.keys(SORT_LABEL) as Sort[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {SORT_LABEL[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div
          className="scrollbar-thin mt-3 flex gap-2 overflow-x-auto pb-0.5"
          role="group"
          aria-label="Categories"
        >
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
              {PRODUCT_CATEGORY_LABEL[c as ProductCategory]}
            </CategoryChip>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={StoreIcon}
            title="Nothing to show"
            description="No products match what you are looking for. Try a different search or category."
            action={
              narrowed ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setCategory("all");
                  }}
                >
                  Show everything
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <>
          <div className="mb-3 flex items-center gap-2">
            <p className="text-muted-foreground text-xs">
              {filtered.length} product{filtered.length > 1 ? "s" : ""}
              {category !== "all" &&
                ` in ${PRODUCT_CATEGORY_LABEL[category as ProductCategory]}`}
            </p>
            {narrowed && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setCategory("all");
                }}
                className="text-brand-700 dark:text-brand-300 text-xs underline-offset-2 hover:underline"
              >
                Clear
              </button>
            )}
          </div>
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

/**
 * What we do, in the first screenful.
 *
 * A customer landing here has usually not met a buying service before, so the
 * three promises are the point of the banner — not decoration. They run inline
 * along the bottom of the same panel rather than in their own row of cards.
 */
function Hero() {
  const where = useWhereWeAre();

  return (
    <div className="brand-gradient text-primary-foreground relative mb-4 overflow-hidden rounded-2xl">
      <div
        aria-hidden
        className="bg-gold-400/15 absolute -top-24 -right-16 size-64 rounded-full blur-2xl"
      />
      <div className="relative px-5 py-7 sm:px-9 sm:py-12">
        <p className="text-gold-300 text-[11px] font-medium tracking-[0.18em] uppercase">
          Amanat Shopping · {where.city}
        </p>
        <h1 className="mt-2 max-w-xl text-2xl font-semibold tracking-tight text-balance sm:text-4xl">
          Anything you want, brought to {where.city}
        </h1>
        <p className="text-primary-foreground/85 mt-2 max-w-lg text-sm sm:text-base">
          Order here, we buy it from the store abroad for you, and you collect
          it from our office in {where.address}.
        </p>

        <div className="border-primary-foreground/20 mt-6 flex flex-wrap gap-x-6 gap-y-2 border-t pt-4 text-xs sm:text-[13px]">
          <Promise icon={WalletIcon}>Pay when you collect</Promise>
          <Promise icon={TruckIcon}>Usually 2–3 weeks</Promise>
          <Promise icon={PackageCheckIcon}>
            <Link href="/track" className="underline-offset-2 hover:underline">
              Track it any time
            </Link>
          </Promise>
        </div>
      </div>
    </div>
  );
}

function Promise({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <Icon className="text-gold-300 size-4 shrink-0" />
      {children}
    </span>
  );
}

/**
 * Image first, name second, price loudest — the marketplace convention.
 *
 * When a product has more than one photo the second one shows on hover, which
 * is how online shops signal "there is more to see here" without costing a
 * click. A count badge says the same thing on touch screens, where there is no
 * hover to discover.
 */
function ProductCard({ product }: { product: PublicProduct }) {
  const [main, second] = product.imageUrls;

  return (
    <Link
      href={`/store/p/${product.slug}`}
      className="focus-visible:ring-ring group rounded-xl focus-visible:ring-2 focus-visible:outline-none"
    >
      <article className="bg-card hover:border-brand-600/50 flex h-full flex-col overflow-hidden rounded-xl border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
        <div className="bg-muted/30 relative aspect-square overflow-hidden">
          <ProductThumb
            size="fill"
            category={product.category}
            name={product.name}
            imageUrl={main}
            className={cn(
              "size-full rounded-none border-0 transition-all duration-300",
              second
                ? "group-hover:opacity-0"
                : "group-hover:scale-[1.04]",
            )}
          />
          {second && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={second}
              alt=""
              aria-hidden
              className="absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            />
          )}
          {product.imageUrls.length > 1 && (
            <span className="bg-background/85 text-muted-foreground absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] backdrop-blur">
              <ImagesIcon className="size-3" />
              {product.imageUrls.length}
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-1 p-2.5">
          <p className="text-muted-foreground text-[10px] tracking-wide uppercase">
            {PRODUCT_CATEGORY_LABEL[product.category]}
          </p>
          <p className="group-hover:text-brand-700 dark:group-hover:text-brand-300 line-clamp-2 text-[13px] leading-snug transition-colors">
            {product.name}
          </p>
          <div className="mt-auto pt-1.5">
            <Money
              value={product.priceAfn}
              unit="suffix"
              className="text-brand-700 dark:text-brand-300 text-[15px] font-bold"
            />
            <p className="text-muted-foreground text-[10px]">Pay on collection</p>
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
      aria-pressed={active}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs transition-colors",
        active
          ? "border-brand-600 bg-brand-700 text-primary-foreground"
          : "hover:border-brand-600/40 hover:bg-muted",
      )}
    >
      {children}
      <span
        className={cn(
          "text-[10px]",
          active ? "opacity-75" : "text-muted-foreground",
        )}
      >
        {count}
      </span>
    </button>
  );
}
