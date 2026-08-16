"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  PackageIcon,
  PlusIcon,
  ShoppingCartIcon,
  TruckIcon,
  UsersIcon,
} from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { allNavLinks } from "@/components/layout/nav-config";
import { useSearch } from "@/lib/api";
import { CARRIER_TRACKING_ENABLED } from "@/lib/constants";

const GROUP_ICON = {
  Orders: ShoppingCartIcon,
  Clients: UsersIcon,
  Shipments: TruckIcon,
  Purchases: PackageIcon,
} as const;

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const results = useSearch(query);

  const grouped = React.useMemo(() => {
    const map = new Map<string, typeof results>();
    results.forEach((result) => {
      const list = map.get(result.group) ?? [];
      list.push(result);
      map.set(result.group, list);
    });
    return Array.from(map.entries());
  }, [results]);

  const go = React.useCallback(
    (href: string) => {
      onOpenChange(false);
      setQuery("");
      router.push(href);
    },
    [router, onOpenChange],
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      {/* Filtering happens in `useSearch`, so cmdk must not filter again. */}
      <CommandInput
        placeholder="Search orders, clients, tracking numbers…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {query
            ? `No results for “${query}”.`
            : CARRIER_TRACKING_ENABLED
              ? "Type to search across orders, clients and shipments."
              : "Type to search across orders, clients and purchases."}
        </CommandEmpty>

        {grouped.map(([group, items]) => {
          const Icon = GROUP_ICON[group as keyof typeof GROUP_ICON];
          return (
            <CommandGroup key={group} heading={group}>
              {items.map((item) => (
                <CommandItem
                  key={`${group}-${item.id}`}
                  value={`${group}-${item.id}-${item.title}`}
                  onSelect={() => go(item.href)}
                >
                  <Icon />
                  <span className="font-medium">{item.title}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {item.subtitle}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}

        {grouped.length > 0 && <CommandSeparator />}

        <CommandGroup heading="Actions">
          <CommandItem value="new-order" onSelect={() => go("/orders/new")}>
            <PlusIcon />
            New order
            <CommandShortcut>⌘N</CommandShortcut>
          </CommandItem>
          <CommandItem value="new-client" onSelect={() => go("/clients/new")}>
            <PlusIcon />
            New client
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="Go to">
          {allNavLinks.map((link) => (
            <CommandItem
              key={link.href}
              value={`nav-${link.section}-${link.label}`}
              onSelect={() => go(link.href)}
            >
              <link.icon />
              {link.label}
              <span className="text-muted-foreground ml-auto text-xs">
                {link.section}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

/** Registers ⌘K / Ctrl-K and returns the palette's open state. */
export function useCommandPalette() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return { open, setOpen };
}
