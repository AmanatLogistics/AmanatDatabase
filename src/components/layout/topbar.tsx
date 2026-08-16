"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BellIcon,
  ChevronRightIcon,
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
import { usePageMeta } from "@/components/layout/use-page-meta";
import {
  clearNotifications,
  markNotificationsRead,
  useNavCounts,
  useNotifications,
  useTeam,
  useToday,
  useUnreadNotificationCount,
} from "@/lib/api";
import { formatAfn, formatRelative, initials } from "@/lib/format";
import type { AppNotification } from "@/lib/types";
import { cn } from "@/lib/utils";

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
  const nav = useNavCounts();
  const meta = usePageMeta();
  const owner = team[0];

  /*
   * The bar carries the page identity for the whole app — the trail on top, the
   * page name as the <h1> below it. Screens no longer print their own heading,
   * which keeps the title visible while the content scrolls and gives every page
   * back ~60px of vertical space.
   *
   * The dashboard is the one exception: "Dashboard" tells the owner nothing they
   * cannot see from the sidebar, so it greets them and states the day's position.
   */
  const isDashboard = pathname === "/";

  const events = useNotifications();
  const unread = useUnreadNotificationCount();
  /*
   * Two different things share this bell: events that happened (appended when
   * they happen) and the derived "needs attention" list (computed from current
   * state). The badge counts unread events, because that is the part that is
   * new since the operator last looked.
   */
  const badgeCount = unread || nav.attention.length;

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
              {greeting(today.getUTCHours())},{" "}
              {owner?.name.split(" ")[0] ?? "there"}
            </h1>
            <p className="text-muted-foreground truncate text-xs">
              {nav.activeOrders} orders in progress ·{" "}
              {formatAfn(nav.outstandingAfn, { unit: "suffix" })} outstanding
            </p>
          </>
        ) : (
          <>
            <nav
              aria-label="Breadcrumb"
              className="text-muted-foreground flex items-center gap-1 text-[11px] leading-none"
            >
              <Link href="/" className="hover:text-foreground transition-colors">
                Home
              </Link>
              {meta.parents.map((crumb) => (
                <span key={crumb.label} className="flex items-center gap-1">
                  <ChevronRightIcon className="size-3 opacity-60" />
                  {crumb.href ? (
                    <Link
                      href={crumb.href}
                      className="hover:text-foreground transition-colors"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    crumb.label
                  )}
                </span>
              ))}
            </nav>
            <h1 className="mt-1 truncate text-[17px] leading-tight font-semibold tracking-tight">
              {meta.title}
            </h1>
          </>
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

      <DropdownMenu
        onOpenChange={(open) => {
          // Seen is seen: opening the panel clears the unread badge.
          if (open && unread > 0) void markNotificationsRead();
        }}
      >
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="relative"
            aria-label={`Notifications (${badgeCount} new)`}
          >
            <BellIcon />
            {badgeCount > 0 && (
              <span className="bg-destructive text-destructive-foreground absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full text-[9px] font-semibold">
                {badgeCount > 9 ? "9+" : badgeCount}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-88 max-h-[70vh] overflow-y-auto">
          {events.length > 0 && (
            <>
              <div className="flex items-center justify-between px-2 py-1.5">
                <DropdownMenuLabel className="p-0">Activity</DropdownMenuLabel>
                <button
                  type="button"
                  onClick={() => void clearNotifications()}
                  className="text-muted-foreground hover:text-foreground text-xs"
                >
                  Clear
                </button>
              </div>
              <DropdownMenuSeparator />
              {events.slice(0, 12).map((event) => (
                <DropdownMenuItem
                  key={event.id}
                  asChild={Boolean(event.href)}
                  data-testid="notification-item"
                  className={cn(!event.read && "bg-brand-700/5")}
                >
                  {event.href ? (
                    <Link href={event.href} className="flex-col items-start gap-0.5">
                      <NotificationBody event={event} />
                    </Link>
                  ) : (
                    <div className="flex flex-col items-start gap-0.5">
                      <NotificationBody event={event} />
                    </div>
                  )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuLabel>Needs attention</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {nav.attention.length === 0 ? (
            <div className="text-muted-foreground px-2 py-6 text-center text-sm">
              Everything is under control.
            </div>
          ) : (
            nav.attention.map((item) => (
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

/**
 * One event line. Kept apart so the linked and unlinked cases cannot drift —
 * a notification about a deleted record has nowhere to go.
 */
function NotificationBody({ event }: { event: AppNotification }) {
  return (
    <>
      <span className="flex w-full items-center gap-2">
        <span
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            event.read ? "bg-muted-foreground/40" : "bg-brand-600",
          )}
        />
        <span className="text-[13px] font-medium">{event.title}</span>
      </span>
      <span className="text-muted-foreground pl-3.5 text-xs">
        {event.description}
      </span>
      <span className="text-muted-foreground/70 pl-3.5 text-[11px]">
        {formatRelative(event.at)}
      </span>
    </>
  );
}
