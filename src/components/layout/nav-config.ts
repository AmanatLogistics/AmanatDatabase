import {
  BanknoteIcon,
  BuildingIcon,
  CalculatorIcon,
  CreditCardIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  type LucideIcon,
  PackageIcon,
  ReceiptTextIcon,
  SettingsIcon,
  ShoppingCartIcon,
  TagsIcon,
  TruckIcon,
  UsersIcon,
  UsersRoundIcon,
  WalletIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Which store counter feeds the badge, if any. */
  badge?: "activeOrders" | "customsHolds" | "overdueClients";
  children?: Array<{ label: string; href: string; icon?: LucideIcon }>;
}

export interface NavSection {
  caption: string;
  items: NavItem[];
}

/** Single source of truth for the sidebar and the command palette. */
export const navigation: NavSection[] = [
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
      {
        label: "Tracking",
        href: "/tracking",
        icon: TruckIcon,
        badge: "customsHolds",
      },
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
          { label: "Expenses", href: "/finance/expenses", icon: ReceiptTextIcon },
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
      {
        label: "Settings",
        href: "/settings",
        icon: SettingsIcon,
        children: [
          { label: "Company profile", href: "/settings", icon: BuildingIcon },
          { label: "Stores", href: "/settings/stores", icon: ShoppingCartIcon },
          {
            label: "Payment methods",
            href: "/settings/payment-methods",
            icon: CreditCardIcon,
          },
          {
            label: "Expense categories",
            href: "/settings/expense-categories",
            icon: TagsIcon,
          },
          { label: "Team", href: "/settings/team", icon: UsersRoundIcon },
        ],
      },
    ],
  },
];

/** Flat list of every navigable page, used by the ⌘K palette. */
export const allNavLinks = navigation.flatMap((section) =>
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
