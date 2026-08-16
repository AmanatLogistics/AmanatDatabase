"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftIcon,
  InboxIcon,
  StoreIcon,
  TagsIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StoreGate } from "@/components/shared/store-gate";
import { useNewWebOrderCount } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * The shop admin's own frame.
 *
 * Kept structurally apart from `AppShell` on purpose. The operations app and
 * the shop are two jobs — one is "where is this parcel and who owes us money",
 * the other is "what are we selling and who just bought something" — and mixing
 * their navigation was the specific thing to avoid. Different rail, different
 * colour, its own header, and one clearly-marked door back to operations.
 */
const NAV = [
  { href: "/shop", label: "Overview", icon: StoreIcon, exact: true },
  { href: "/shop/products", label: "Products", icon: TagsIcon },
  { href: "/shop/orders", label: "Website orders", icon: InboxIcon, badge: true },
];

export function ShopShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const newOrders = useNewWebOrderCount();

  return (
    <div className="bg-muted/30 min-h-dvh">
      {/*
       * A dark bar, where the operations app has a light one. The point is that
       * a glance tells you which system you are in before you read anything.
       */}
      <header className="bg-brand-950 text-primary-foreground sticky top-0 z-30">
        <div className="mx-auto flex w-full max-w-[1400px] items-center gap-4 px-4 py-3 sm:px-6">
          <Link href="/shop" className="flex items-center gap-2 font-semibold">
            <StoreIcon className="size-5" />
            <span>Amanat Shop</span>
          </Link>
          <span className="bg-primary-foreground/15 rounded px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase">
            Storefront admin
          </span>

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10"
            >
              <Link href="/store" target="_blank">
                View storefront
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10"
            >
              <Link href="/">
                <ArrowLeftIcon />
                Operations
              </Link>
            </Button>
          </div>
        </div>

        <nav className="border-primary-foreground/10 mx-auto flex w-full max-w-[1400px] gap-1 border-t px-2 sm:px-4">
          {NAV.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "border-gold-400 text-primary-foreground font-medium"
                    : "text-primary-foreground/70 hover:text-primary-foreground border-transparent",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
                {item.badge && newOrders > 0 && (
                  <Badge variant="gold" className="h-4 px-1.5 text-[10px]">
                    {newOrders}
                  </Badge>
                )}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-[1400px] space-y-4 p-4 sm:px-6 sm:py-6">
        <StoreGate>{children}</StoreGate>
      </main>
    </div>
  );
}
