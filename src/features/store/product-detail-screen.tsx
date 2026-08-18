"use client";

import * as React from "react";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeftIcon, ShoppingBagIcon } from "lucide-react";

import { Money } from "@/components/shared/money";
import { ProductThumb } from "@/components/shared/product-thumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { addToCart, useStoreProductBySlug } from "@/lib/api";
import { PRODUCT_CATEGORY_LABEL } from "@/lib/constants";
import { useStoreHydrated } from "@/lib/hydration";

/** One product, and the decision to buy it. */
export function ProductDetailScreen({ slug }: { slug: string }) {
  const router = useRouter();
  const hydrated = useStoreHydrated();
  const product = useStoreProductBySlug(slug);
  const [qty, setQty] = React.useState(1);

  // The catalogue lives in the browser, so nothing is known until it has loaded.
  if (!hydrated) {
    return (
      <div className="grid gap-6 sm:grid-cols-2">
        <Skeleton className="aspect-square w-full" />
        <div className="space-y-3">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-11 w-40" />
        </div>
      </div>
    );
  }

  if (!product) notFound();

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="-ml-2 mb-4 w-fit">
        <Link href="/store">
          <ArrowLeftIcon />
          All products
        </Link>
      </Button>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="bg-muted/30 aspect-square overflow-hidden rounded-xl border">
          <ProductThumb
            size="lg"
            category={product.category}
            name={product.name}
            imageUrl={product.imageUrl}
            className="size-full rounded-none border-0"
          />
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <p className="text-muted-foreground text-xs">
              {PRODUCT_CATEGORY_LABEL[product.category]}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">
              {product.name}
            </h1>
          </div>

          <Money
            value={product.priceAfn}
            unit="suffix"
            className="text-brand-700 dark:text-brand-300 text-3xl font-bold"
          />
          <p className="text-muted-foreground -mt-2 text-xs">
            Pay when you collect. No deposit.
          </p>

          <p className="text-muted-foreground text-sm">{product.description}</p>

          <Card className="bg-muted/40">
            <CardContent className="pt-6">
              <p className="text-xs font-medium">How it works</p>
              <ol className="text-muted-foreground mt-2 grid gap-1.5 text-xs">
                <li>1. We confirm the price with you by phone.</li>
                <li>2. We buy it from the store and bring it to Kabul.</li>
                <li>3. We call you when it reaches our office.</li>
                <li>4. You pay and collect. Usually 2–3 weeks.</li>
              </ol>
            </CardContent>
          </Card>

          <div className="mt-auto flex items-center gap-2">
            <div className="flex items-center rounded-md border">
              <button
                type="button"
                aria-label="Fewer"
                className="hover:bg-muted px-3 py-2 text-lg leading-none"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
              >
                −
              </button>
              <span className="tabular w-10 text-center text-sm">{qty}</span>
              <button
                type="button"
                aria-label="More"
                className="hover:bg-muted px-3 py-2 text-lg leading-none"
                onClick={() => setQty((q) => Math.min(20, q + 1))}
              >
                +
              </button>
            </div>
            <Button
              className="h-11 flex-1"
              onClick={() => {
                addToCart(product.id, qty);
                toast.success(`${product.name} added to your basket`);
                router.push("/store/cart");
              }}
            >
              <ShoppingBagIcon />
              Add to basket
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
