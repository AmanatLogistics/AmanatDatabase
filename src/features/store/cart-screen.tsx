"use client";

import Link from "next/link";
import { ShoppingBagIcon } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Money } from "@/components/shared/money";
import { ProductThumb } from "@/components/shared/product-thumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { setCartQty, useCart } from "@/lib/api";
import { useStoreHydrated } from "@/lib/hydration";

/** The basket. Lives in this browser and survives a refresh. */
export function CartScreen() {
  const hydrated = useStoreHydrated();
  const { lines, totalAfn } = useCart();

  if (!hydrated) return null;

  if (lines.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={ShoppingBagIcon}
          title="Your basket is empty"
          description="Add something from the shop and it will appear here."
          action={
            <Button asChild>
              <Link href="/store">Browse products</Link>
            </Button>
          }
        />
      </Card>
    );
  }

  return (
    <>
      <h1 className="mb-5 text-2xl font-semibold tracking-tight">
        Your basket
      </h1>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardContent className="pt-6">
            <ul className="divide-y">
              {lines.map(({ product, qty, lineTotalAfn }) => (
                <li key={product.id} className="flex items-center gap-3 py-3">
                  {/* No photo, no grey square standing in for one. */}
                  {product.imageUrls[0] && (
                    <ProductThumb
                      size="md"
                      category={product.category}
                      name={product.name}
                      imageUrl={product.imageUrls[0]}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/store/p/${product.slug}`}
                      className="line-clamp-1 text-sm font-medium hover:underline"
                    >
                      {product.name}
                    </Link>
                    <Money
                      value={product.priceAfn}
                      unit="suffix"
                      className="text-muted-foreground text-xs"
                    />
                  </div>
                  <div className="flex items-center rounded-md border">
                    <button
                      type="button"
                      aria-label={`Fewer ${product.name}`}
                      className="hover:bg-muted px-2.5 py-1.5 leading-none"
                      onClick={() => setCartQty(product.id, qty - 1)}
                    >
                      −
                    </button>
                    <span className="tabular w-8 text-center text-sm">
                      {qty}
                    </span>
                    <button
                      type="button"
                      aria-label={`More ${product.name}`}
                      className="hover:bg-muted px-2.5 py-1.5 leading-none"
                      onClick={() => setCartQty(product.id, qty + 1)}
                    >
                      +
                    </button>
                  </div>
                  <Money
                    value={lineTotalAfn}
                    className="w-24 text-right text-sm font-medium"
                  />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Products</span>
              <Money value={totalAfn} unit="suffix" />
            </div>
            <Separator className="my-3" />
            <div className="flex items-center justify-between font-semibold">
              <span>Total</span>
              <Money value={totalAfn} unit="suffix" />
            </div>
            <p className="text-muted-foreground mt-2 text-xs">
              You pay when you collect. We will call you first.
            </p>
            <Button asChild className="mt-4 h-11 w-full">
              <Link href="/store/checkout">Continue to checkout</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
