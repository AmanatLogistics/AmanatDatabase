"use client";

import * as React from "react";
import Link from "next/link";
import { ShoppingBagIcon } from "lucide-react";

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
 */
export function StorefrontShell({ children }: { children: React.ReactNode }) {
  const hydrated = useStoreHydrated();
  const { count } = useCart();

  return (
    <div className="bg-background flex min-h-dvh flex-col">
      <header className="bg-background/95 sticky top-0 z-30 border-b backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-4 px-4 py-3">
          <Link href="/store" aria-label="Amanat Shopping home">
            <Logo />
          </Link>
          <nav className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/track">Track an order</Link>
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

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-10">
        {children}
      </main>

      <footer className="border-t">
        <div className="text-muted-foreground mx-auto w-full max-w-5xl px-4 py-6 text-center text-xs">
          Amanat Shopping · Kabul · We buy it for you and you collect it from our
          office.
        </div>
      </footer>
    </div>
  );
}
