"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { settingsPages } from "@/components/layout/nav-config";
import { cn } from "@/lib/utils";

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="scrollbar-thin flex gap-1 overflow-x-auto lg:flex-col lg:gap-0.5">
      {settingsPages.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <link.icon className="size-4" />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
