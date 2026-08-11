"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BellIcon,
  MenuIcon,
  MessageSquareIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDashboard, useTeam, useToday } from "@/lib/api";
import { formatAfn, initials } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Page titles for routes the breadcrumb can't infer from a record. */
const TITLES: Record<string, string> = {
  "/orders": "Orders",
  "/orders/new": "New order",
  "/clients": "Clients",
  "/clients/new": "New client",
  "/purchases": "Purchases",
  "/tracking": "Tracking",
  "/payments": "Payments",
  "/finance": "Finance & accounting",
  "/finance/expenses": "Expenses",
  "/finance/balances": "Client balances",
  "/documents": "Documents",
  "/settings": "Settings",
  "/settings/stores": "Stores",
  "/settings/payment-methods": "Payment methods",
  "/settings/expense-categories": "Expense categories",
  "/settings/team": "Team",
};

function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function Topbar({
  onOpenSearch,
  onOpenMobileNav,
}: {
  onOpenSearch: () => void;
  onOpenMobileNav: () => void;
}) {
  const pathname = usePathname();
  const team = useTeam();
  const today = useToday();
  const dashboard = useDashboard();
  const owner = team[0];

  const isDashboard = pathname === "/";
  const title = TITLES[pathname] ?? "";

  const notifications = dashboard.attention.length;

  return (
    <header className="bg-background/85 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b px-4 backdrop-blur-md sm:px-6">
      <Button
        variant="ghost"
        size="icon-sm"
        className="lg:hidden"
        onClick={onOpenMobileNav}
        aria-label="Open navigation"
      >
        <MenuIcon />
      </Button>

      <div className="min-w-0 flex-1">
        {isDashboard ? (
          <>
            <h1 className="truncate text-[17px] leading-tight font-semibold tracking-tight">
              {greeting(today.getUTCHours())}, {owner?.name.split(" ")[0] ?? "there"}
            </h1>
            <p className="text-muted-foreground truncate text-xs">
              {dashboard.activeOrders} orders in progress ·{" "}
              {formatAfn(dashboard.outstandingAfn)} outstanding
            </p>
          </>
        ) : (
          title && (
            <h1 className="truncate text-[17px] font-semibold tracking-tight">
              {title}
            </h1>
          )
        )}
      </div>

      {/* Search trigger — the real input lives in the ⌘K palette. */}
      <button
        type="button"
        onClick={onOpenSearch}
        className={cn(
          "text-muted-foreground hover:border-ring/50 hover:text-foreground hidden h-9 w-56 items-center gap-2 rounded-lg border px-3 text-[13px] transition-colors md:flex xl:w-72",
        )}
      >
        <SearchIcon className="size-4" />
        <span className="flex-1 text-left">Search anything…</span>
        <kbd className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-sans text-[10px] font-medium">
          ⌘K
        </kbd>
      </button>

      <Button
        variant="ghost"
        size="icon-sm"
        className="md:hidden"
        onClick={onOpenSearch}
        aria-label="Search"
      >
        <SearchIcon />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="relative"
            aria-label={`Notifications (${notifications})`}
          >
            <BellIcon />
            {notifications > 0 && (
              <span className="bg-destructive text-destructive-foreground absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full text-[9px] font-semibold">
                {notifications}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel>Needs attention</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {dashboard.attention.length === 0 ? (
            <div className="text-muted-foreground px-2 py-6 text-center text-sm">
              Everything is under control.
            </div>
          ) : (
            dashboard.attention.map((item) => (
              <DropdownMenuItem key={item.id} asChild>
                <Link href={item.href} className="flex-col items-start gap-0.5">
                  <span className="text-[13px] font-medium">{item.title}</span>
                  <span className="text-muted-foreground text-xs">
                    {item.description}
                  </span>
                </Link>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button variant="ghost" size="icon-sm" className="hidden sm:inline-flex" asChild>
        <Link href="/documents" aria-label="Documents">
          <MessageSquareIcon />
        </Link>
      </Button>

      <Button size="sm" asChild className="hidden sm:inline-flex">
        <Link href="/orders/new">
          <PlusIcon />
          New order
        </Link>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="bg-brand-700 text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
            aria-label="Account menu"
          >
            {initials(owner?.name ?? "AS")}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="text-foreground">
            <div className="space-y-0.5">
              <p className="text-[13px] font-medium">{owner?.name}</p>
              <p className="text-muted-foreground text-xs font-normal">
                {owner?.email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/settings">Company profile</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/settings/team">Team</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled>
            Sign out
            <span className="text-muted-foreground ml-auto text-[10px]">
              no auth yet
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
