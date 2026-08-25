import {
  BanknoteIcon,
  BuildingIcon,
  CalculatorIcon,
  CreditCardIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  type LucideIcon,
  PackageIcon,
  SettingsIcon,
  ShoppingCartIcon,
  StoreIcon,
  UsersIcon,
  UsersRoundIcon,
  WalletIcon,
} from "lucide-react";

import { SHOP_ENABLED } from "@/lib/constants";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Which store counter feeds the badge, if any. */
  badge?: "activeOrders" | "overdueClients";
  children?: Array<{ label: string; href: string; icon?: LucideIcon }>;
}

export interface NavSection {
  caption: string;
  items: NavItem[];
}

/** Single source of truth for the sidebar and the command palette. */
const ALL_SECTIONS: NavSection[] = [
  {
    caption: "Overview",
    items: [{ label: "Dashboard", href: "/", icon: LayoutDashboardIcon }],
  },
  {
    caption: "Operations",
    items: [
      {
        label: "Orders",
        href: "/orders",
        icon: ShoppingCartIcon,
        badge: "activeOrders",
      },
      { label: "Clients", href: "/clients", icon: UsersIcon },
      { label: "Purchases", href: "/purchases", icon: PackageIcon },
    ],
  },
  {
    caption: "Online shop",
    items: [
      /*
       * The one door between the two systems. The shop keeps its own shell and
       * navigation — this is a link across, not a merge. Removed entirely when
       * the shop is off, rather than shown leading to a 404.
       */
      { label: "Shop admin", href: "/shop", icon: StoreIcon },
    ],
  },
  {
    caption: "Finance",
    items: [
      { label: "Payments", href: "/payments", icon: WalletIcon },
      {
        label: "Finance & Accounting",
        href: "/finance",
        icon: CalculatorIcon,
        children: [
          { label: "Profit & loss", href: "/finance", icon: CalculatorIcon },
          {
            label: "Client balances",
            href: "/finance/balances",
            icon: BanknoteIcon,
          },
        ],
      },
      { label: "Documents", href: "/documents", icon: FileTextIcon },
    ],
  },
  {
    caption: "System",
    items: [
      /*
       * No `children` here on purpose: the Settings screen renders its own
       * sub-navigation column, so expanding the same five links in the sidebar
       * would show the identical list twice.
       */
      { label: "Settings", href: "/settings", icon: SettingsIcon },
    ],
  },
];

/**
 * Settings sub-pages. Rendered as the in-page column on /settings and folded
 * into the ⌘K palette below — the sidebar deliberately does not repeat them.
 */
export const settingsPages = [
  { label: "Company profile", href: "/settings", icon: BuildingIcon },
  { label: "Stores", href: "/settings/stores", icon: ShoppingCartIcon },
  {
    label: "Payment methods",
    href: "/settings/payment-methods",
    icon: CreditCardIcon,
  },
  { label: "Team", href: "/settings/team", icon: UsersRoundIcon },
];

/**
 * What the sidebar actually shows.
 *
 * The shop section comes out when the shop is off. Filtering here rather than
 * in the sidebar means the ⌘K palette below loses it too — a command palette
 * that still offers "Shop admin" is how a supposedly absent feature comes back
 * to haunt you.
 */
export const navigation: NavSection[] = ALL_SECTIONS.filter(
  (section) => SHOP_ENABLED || section.caption !== "Online shop",
);

/** Flat list of every navigable page, used by the ⌘K palette. */
const sidebarLinks = navigation.flatMap((section) =>
  section.items.flatMap((item) =>
    item.children
      ? item.children.map((child) => ({
          label: child.label,
          href: child.href,
          section: section.caption,
          icon: child.icon ?? item.icon,
        }))
      : [
          {
            label: item.label,
            href: item.href,
            section: section.caption,
            icon: item.icon,
          },
        ],
  ),
);

export const allNavLinks = [
  ...sidebarLinks,
  // The settings sub-pages are still reachable from the palette even though the
  // sidebar links only to the settings landing page.
  ...settingsPages
    .filter((page) => page.href !== "/settings")
    .map((page) => ({ ...page, section: "Settings" })),
];
