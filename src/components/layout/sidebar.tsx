"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  ChevronDownIcon,
  HelpCircleIcon,
  MoonIcon,
  PanelLeftCloseIcon,
  SunIcon,
} from "lucide-react";

import { Logo, LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { navigation, type NavItem } from "@/components/layout/nav-config";
import { useNavCounts, useTeam } from "@/lib/api";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

/** No-op subscribe for the hydration guard below — the value never changes. */
const subscribeNever = () => () => {};

function isActiveHref(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({
  collapsed,
  onToggleCollapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /** Called after a link is followed — closes the mobile drawer. */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const nav = useNavCounts();
  const team = useTeam();
  const owner = team[0];

  const badgeCounts: Record<string, number> = {
    activeOrders: nav.activeOrders,
    overdueClients: nav.attention.filter((a) => a.kind === "overdue").length,
  };

  return (
    <aside
      className={cn(
        "bg-sidebar border-sidebar-border flex h-full flex-col border-r transition-[width] duration-200",
        collapsed ? "w-[68px]" : "w-[248px]",
      )}
    >
      {/* Brand */}
      <div
        className={cn(
          "flex h-16 shrink-0 items-center gap-2 px-4",
          collapsed && "justify-center px-0",
        )}
      >
        <Link href="/" onClick={onNavigate} className="min-w-0">
          {collapsed ? (
            <span className="brand-gradient text-primary-foreground flex size-9 items-center justify-center rounded-lg shadow-sm">
              <LogoMark className="size-5" />
            </span>
          ) : (
            <Logo />
          )}
        </Link>
        {!collapsed && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onToggleCollapsed}
            className="text-muted-foreground ml-auto hidden lg:inline-flex"
            aria-label="Collapse sidebar"
          >
            <PanelLeftCloseIcon />
          </Button>
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1">
        <nav className={cn("flex flex-col gap-5 px-3 pt-1 pb-4", collapsed && "px-2")}>
          {navigation.map((section) => (
            <div key={section.caption} className="space-y-1">
              {!collapsed && (
                <p className="text-muted-foreground/70 px-2 pb-1 text-[10px] font-semibold tracking-[0.09em] uppercase">
                  {section.caption}
                </p>
              )}
              {section.items.map((item) => (
                <NavEntry
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  collapsed={collapsed}
                  badge={item.badge ? badgeCounts[item.badge] : undefined}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          ))}
        </nav>
      </ScrollArea>

      {/* Footer: user card + theme toggle */}
      <div
        className={cn(
          "border-sidebar-border shrink-0 space-y-2 border-t p-3",
          collapsed && "px-2",
        )}
      >
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <span className="bg-brand-700 text-primary-foreground flex size-9 items-center justify-center rounded-full text-xs font-semibold">
              {initials(owner?.name ?? "AS")}
            </span>
            <ThemeToggle collapsed />
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onToggleCollapsed}
              className="text-muted-foreground"
              aria-label="Expand sidebar"
            >
              <PanelLeftCloseIcon className="rotate-180" />
            </Button>
          </div>
        ) : (
          <>
            <div className="bg-sidebar-accent flex items-center gap-2.5 rounded-lg p-2">
              <span className="bg-brand-700 text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                {initials(owner?.name ?? "AS")}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">
                  {owner?.name ?? "Amanat"}
                </p>
                <p className="text-muted-foreground truncate text-[11px] capitalize">
                  {owner?.role ?? "owner"}
                </p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href="/settings"
                    onClick={onNavigate}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Help and settings"
                  >
                    <HelpCircleIcon className="size-4" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent>Settings &amp; help</TooltipContent>
              </Tooltip>
            </div>
            <ThemeToggle />
          </>
        )}
      </div>
    </aside>
  );
}

function NavEntry({
  item,
  pathname,
  collapsed,
  badge,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
  badge?: number;
  onNavigate?: () => void;
}) {
  const active = isActiveHref(pathname, item.href);
  const hasChildren = !!item.children?.length;
  const [open, setOpen] = React.useState(active);

  // Expand the group when navigating into one of its children.
  const [wasActive, setWasActive] = React.useState(active);
  if (wasActive !== active) {
    setWasActive(active);
    if (active) setOpen(true);
  }

  const Icon = item.icon;

  const body = (
    <>
      <Icon className="size-4 shrink-0" />
      {!collapsed && <span className="flex-1 truncate text-left">{item.label}</span>}
      {!collapsed && badge !== undefined && badge > 0 && (
        <span
          className={cn(
            "tabular rounded px-1.5 py-0.5 text-[11px] font-medium",
            active
              ? "bg-primary/15 text-primary"
              : "bg-muted text-muted-foreground",
          )}
        >
          {badge}
        </span>
      )}
      {!collapsed && hasChildren && (
        <ChevronDownIcon
          className={cn(
            "size-3.5 shrink-0 transition-transform",
            open && "rotate-180",
          )}
        />
      )}
    </>
  );

  const linkClass = cn(
    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
    collapsed && "justify-center px-0",
    active
      ? "bg-sidebar-accent text-sidebar-accent-foreground"
      : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link href={item.href} onClick={onNavigate} className={linkClass}>
            {body}
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    );
  }

  if (!hasChildren) {
    return (
      <Link href={item.href} onClick={onNavigate} className={linkClass}>
        {body}
      </Link>
    );
  }

  return (
    <div>
      <button type="button" onClick={() => setOpen((v) => !v)} className={linkClass}>
        {body}
      </button>
      {open && (
        <div className="border-sidebar-border mt-1 ml-[19px] space-y-0.5 border-l pl-3">
          {item.children!.map((child) => {
            const childActive = pathname === child.href;
            return (
              <Link
                key={child.href}
                href={child.href}
                onClick={onNavigate}
                className={cn(
                  "block rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
                  childActive
                    ? "text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {child.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Light/dark segmented control, mirroring the reference sidebar footer. */
function ThemeToggle({ collapsed = false }: { collapsed?: boolean }) {
  const { theme, setTheme } = useTheme();
  // The stored theme is unknown during SSR, so the active segment is only
  // resolved after hydration. `useSyncExternalStore` gives that guard without
  // a mount effect.
  const mounted = React.useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );

  const current = mounted ? theme : undefined;

  if (collapsed) {
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setTheme(current === "dark" ? "light" : "dark")}
        className="text-muted-foreground"
        aria-label="Toggle theme"
      >
        {current === "dark" ? <SunIcon /> : <MoonIcon />}
      </Button>
    );
  }

  return (
    <div className="bg-muted grid grid-cols-2 gap-1 rounded-lg p-1">
      {(["light", "dark"] as const).map((option) => {
        const active = current === option;
        const Icon = option === "light" ? SunIcon : MoonIcon;
        return (
          <button
            key={option}
            type="button"
            onClick={() => setTheme(option)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-md py-1.5 text-[12px] font-medium capitalize transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" />
            {option}
          </button>
        );
      })}
    </div>
  );
}
