"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PackageCheckIcon,
  PhoneCallIcon,
  ShoppingBagIcon,
  TruckIcon,
  WalletIcon,
} from "lucide-react";

import { Money } from "@/components/shared/money";
import { ProductThumb } from "@/components/shared/product-thumb";
import { Button } from "@/components/ui/button";
import { addToCart, useWhereWeAre } from "@/lib/api";
import { PRODUCT_CATEGORY_LABEL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { PublicProduct } from "@/lib/types";

/**
 * One product, and the decision to buy it.
 *
 * The product and its neighbours are fetched by the server and arrive as
 * props — the page 404s before this renders if there is nothing to show, so
 * there is no "not found" state to hold here.
 */
export function ProductDetailScreen({
  product,
  related,
}: {
  product: PublicProduct;
  related: PublicProduct[];
}) {
  const router = useRouter();
  const where = useWhereWeAre();
  const [qty, setQty] = React.useState(1);
  const hasPhotos = product.imageUrls.length > 0;

  const buy = () => {
    addToCart(product.id, qty);
    toast.success(`${product.name} added to your basket`);
    router.push("/store/cart");
  };

  return (
    <>
      <nav
        aria-label="Breadcrumb"
        className="text-muted-foreground mb-4 flex flex-wrap items-center gap-1.5 text-xs"
      >
        <Link href="/store" className="hover:text-foreground">
          Shop
        </Link>
        <ChevronRightIcon className="size-3" />
        <Link
          href={`/store?category=${product.category}`}
          className="hover:text-foreground"
        >
          {PRODUCT_CATEGORY_LABEL[product.category]}
        </Link>
        <ChevronRightIcon className="size-3" />
        <span className="text-foreground line-clamp-1">{product.name}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
        {/*
         * No photograph, no empty frame. A placeholder square holding five
         * columns of a product page says "the image is missing"; giving that
         * width back to the description and the steps says "this is the
         * product", which is the truth when nobody uploaded a photo.
         */}
        {hasPhotos && (
          <div className="lg:col-span-5">
            <Gallery product={product} />
          </div>
        )}

        {/*
         * Without the gallery the column is twice as wide, and a price panel
         * stretched across all of it looks like a mistake. Capped to a
         * comfortable measure instead — the leftover space is quieter than a
         * banner would be.
         */}
        <div
          className={cn(
            "flex flex-col gap-4",
            hasPhotos ? "lg:col-span-4" : "lg:col-span-8 lg:max-w-2xl",
          )}
        >
          <div>
            <p className="text-muted-foreground text-[11px] tracking-wide uppercase">
              {PRODUCT_CATEGORY_LABEL[product.category]}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              {product.name}
            </h1>
          </div>

          <div className="bg-brand-50/60 dark:bg-brand-950/40 border-brand-200/60 dark:border-brand-900 rounded-xl border px-4 py-3">
            <Money
              value={product.priceAfn}
              unit="suffix"
              className="text-brand-700 dark:text-brand-300 text-3xl font-bold"
            />
            <p className="text-muted-foreground mt-0.5 text-xs">
              Pay when you collect. No deposit, no card needed.
            </p>
          </div>

          {product.description && (
            <div>
              <h2 className="text-sm font-medium">About this product</h2>
              <p className="text-muted-foreground mt-1.5 text-sm whitespace-pre-line">
                {product.description}
              </p>
            </div>
          )}

          <div>
            <h2 className="text-sm font-medium">How it works</h2>
            <ol className="mt-2 grid gap-2.5">
              <Step icon={PhoneCallIcon} n={1}>
                We confirm the price with you by phone.
              </Step>
              <Step icon={ShoppingBagIcon} n={2}>
                We buy it from the store abroad.
              </Step>
              <Step icon={TruckIcon} n={3}>
                It travels to our office in {where.city} — usually 2–3 weeks.
              </Step>
              <Step icon={WalletIcon} n={4}>
                We call you, you pay and collect.
              </Step>
            </ol>
          </div>
        </div>

        {/* The buy box: everything needed to decide, in one panel. */}
        <div className="lg:col-span-3">
          <div className="bg-card rounded-xl border p-4 lg:sticky lg:top-24">
            <p className="text-muted-foreground text-xs">Total</p>
            <Money
              value={product.priceAfn * qty}
              unit="suffix"
              className="text-xl font-bold"
            />

            <div className="mt-3">
              <p className="mb-1.5 text-xs font-medium">Quantity</p>
              <QtyStepper value={qty} onChange={setQty} />
            </div>

            <Button className="mt-3 h-11 w-full" onClick={buy}>
              <ShoppingBagIcon />
              Add to basket
            </Button>

            <ul className="text-muted-foreground mt-4 grid gap-2 border-t pt-3 text-xs">
              <li className="flex items-center gap-2">
                <WalletIcon className="text-brand-600 size-3.5 shrink-0" />
                Pay on collection
              </li>
              <li className="flex items-center gap-2">
                <TruckIcon className="text-brand-600 size-3.5 shrink-0" />
                Usually 2–3 weeks
              </li>
              <li className="flex items-center gap-2">
                <PackageCheckIcon className="text-brand-600 size-3.5 shrink-0" />
                Track it the whole way
              </li>
            </ul>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-10">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold tracking-tight">
              More in {PRODUCT_CATEGORY_LABEL[product.category]}
            </h2>
            <Link
              href="/store"
              className="text-brand-700 dark:text-brand-300 text-xs underline-offset-2 hover:underline"
            >
              See everything
            </Link>
          </div>
          <div
            className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5"
            data-testid="related-products"
          >
            {related.map((p) => (
              <RelatedCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/*
       * On a phone the buy button would otherwise sit far below the fold, under
       * the description and the four steps. It follows the customer down the
       * page instead, the way a shop app does.
       */}
      <div className="bg-background/95 sticky bottom-0 z-20 -mx-4 mt-8 flex items-center gap-3 border-t px-4 py-3 backdrop-blur lg:hidden">
        <div className="min-w-0">
          <Money
            value={product.priceAfn * qty}
            unit="suffix"
            className="text-brand-700 dark:text-brand-300 block text-base font-bold"
          />
          <p className="text-muted-foreground text-[10px]">Pay on collection</p>
        </div>
        <Button className="ml-auto h-11 flex-1" onClick={buy}>
          <ShoppingBagIcon />
          Add to basket
        </Button>
      </div>
    </>
  );
}

function Step({
  icon: Icon,
  n,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  n: number;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-2.5 text-sm">
      <span className="bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full">
        <Icon className="size-3.5" />
      </span>
      <span className="text-muted-foreground">
        <span className="text-foreground font-medium">{n}.</span> {children}
      </span>
    </li>
  );
}

function QtyStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex w-fit items-center rounded-md border">
      <button
        type="button"
        aria-label="Fewer"
        className="hover:bg-muted rounded-l-md px-3 py-2 text-lg leading-none disabled:opacity-40"
        disabled={value <= 1}
        onClick={() => onChange(Math.max(1, value - 1))}
      >
        −
      </button>
      <span className="tabular w-10 text-center text-sm" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        aria-label="More"
        className="hover:bg-muted rounded-r-md px-3 py-2 text-lg leading-none disabled:opacity-40"
        disabled={value >= 20}
        onClick={() => onChange(Math.min(20, value + 1))}
      >
        +
      </button>
    </div>
  );
}

/**
 * Main image with thumbnails beneath, the way every shop does it.
 *
 * The selection is keyed on the product id so navigating from one product to
 * another does not leave the previous product's third photo selected.
 */
function Gallery({ product }: { product: PublicProduct }) {
  const [active, setActive] = React.useState(0);
  const [seenId, setSeenId] = React.useState(product.id);
  if (seenId !== product.id) {
    setSeenId(product.id);
    setActive(0);
  }

  const images = product.imageUrls;
  const index = Math.min(active, Math.max(0, images.length - 1));
  const current = images[index];
  const step = (by: number) =>
    setActive((index + by + images.length) % images.length);

  return (
    <div className="flex flex-col gap-2.5 lg:sticky lg:top-24">
      <div className="bg-muted/30 group relative aspect-square overflow-hidden rounded-xl border">
        <ProductThumb
          size="fill"
          category={product.category}
          name={product.name}
          imageUrl={current}
          className="size-full rounded-none border-0"
        />

        {images.length > 1 && (
          <>
            <ArrowButton side="left" onClick={() => step(-1)} />
            <ArrowButton side="right" onClick={() => step(1)} />
            <span className="bg-background/85 text-muted-foreground absolute right-2 bottom-2 rounded-full px-2 py-0.5 text-[11px] backdrop-blur">
              {index + 1} / {images.length}
            </span>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div
          className="scrollbar-thin flex gap-2 overflow-x-auto"
          data-testid="gallery-thumbs"
        >
          {images.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Show photo ${i + 1}`}
              aria-current={i === index}
              className={cn(
                "size-16 shrink-0 overflow-hidden rounded-lg border-2 transition-all",
                i === index
                  ? "border-brand-600"
                  : "border-transparent opacity-60 hover:opacity-100",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Hidden until hover on a desktop; always there on touch, which has no hover. */
function ArrowButton({
  side,
  onClick,
}: {
  side: "left" | "right";
  onClick: () => void;
}) {
  const Icon = side === "left" ? ChevronLeftIcon : ChevronRightIcon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous photo" : "Next photo"}
      className={cn(
        "bg-background/85 hover:bg-background absolute top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full border shadow-sm backdrop-blur transition-opacity",
        "sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100",
        side === "left" ? "left-2" : "right-2",
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}

function RelatedCard({ product }: { product: PublicProduct }) {
  const photo = product.imageUrls[0];

  return (
    <Link href={`/store/p/${product.slug}`} className="group">
      <article className="bg-card hover:border-brand-600/50 flex h-full flex-col overflow-hidden rounded-xl border transition-all hover:-translate-y-0.5 hover:shadow-md">
        {/* Same reasoning as the storefront grid: no photo, no empty frame. */}
        {photo ? (
          <div className="bg-muted/30 aspect-square overflow-hidden">
            <ProductThumb
              size="fill"
              category={product.category}
              name={product.name}
              imageUrl={photo}
              className="size-full rounded-none border-0 transition-transform duration-200 group-hover:scale-[1.04]"
            />
          </div>
        ) : (
          <span aria-hidden className="bg-brand-600/70 h-1" />
        )}
        <div className="flex flex-1 flex-col gap-1 p-2.5">
          <p className="line-clamp-2 text-[13px] leading-snug">{product.name}</p>
          <Money
            value={product.priceAfn}
            unit="suffix"
            className="text-brand-700 dark:text-brand-300 mt-auto pt-1 text-[15px] font-bold"
          />
        </div>
      </article>
    </Link>
  );
}
