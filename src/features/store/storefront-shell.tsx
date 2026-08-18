"use client";

import * as React from "react";
import Link from "next/link";
import { PackageSearchIcon, ShoppingBagIcon } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/api";
import { startHydration, useStoreHydrated } from "@/lib/hydration";

startHydration();

/**
 * The storefront's frame — a shop, not an admin tool.
 *
 * Light, roomy, one row of navigation, and the basket always in reach. It
 * shares nothing with either admin shell beyond the brand.
 *
 * The header height is fixed rather than derived from its padding, because the
 * storefront's search bar sticks directly beneath it and needs a number to
 * offset against. Change the height here and change `top-14 sm:top-16` in
 * `storefront-screen.tsx` with it.
 */
export function StorefrontShell({ children }: { children: React.ReactNode }) {
  const hydrated = useStoreHydrated();
  const { count } = useCart();

  return (
    <div className="bg-background flex min-h-dvh flex-col">
      <header className="bg-background/95 sticky top-0 z-30 h-14 border-b backdrop-blur sm:h-16">
        <div className="mx-auto flex h-full w-full max-w-7xl items-center gap-4 px-4">
          <Link href="/store" aria-label="Amanat Shopping home">
            <Logo />
          </Link>
          <nav className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/track">
                <PackageSearchIcon />
                <span className="hidden sm:inline">Track an order</span>
                <span className="sm:hidden">Track</span>
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild className="relative">
              <Link href="/store/cart">
                <ShoppingBagIcon />
                <span className="hidden sm:inline">Basket</span>
                {hydrated && count > 0 && (
                  <Badge
                    variant="brand"
                    className="ml-1 h-5 min-w-5 justify-center px-1 text-[10px]"
                  >
                    {count}
                  </Badge>
                )}
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:py-8">
        {children}
      </main>

      <footer className="bg-muted/30 border-t">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-1 px-4 py-8 text-center">
          <p className="text-sm font-medium">Amanat Shopping</p>
          <p className="text-muted-foreground text-xs">
            Shahr-e-Naw, Kabul · We buy it for you abroad and you collect it from
            our office.
          </p>
          <p className="text-muted-foreground mt-2 text-xs">
            <Link href="/track" className="underline-offset-2 hover:underline">
              Track an order
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
