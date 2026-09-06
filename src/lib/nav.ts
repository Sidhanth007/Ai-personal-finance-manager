import {
  ArrowLeftRight,
  ChartColumn,
  CreditCard,
  LayoutDashboard,
  PiggyBank,
  Receipt,
  Repeat,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/budgets", label: "Budgets", icon: Wallet },
  { href: "/goals", label: "Savings goals", icon: Target },
  { href: "/bills", label: "Bills", icon: Receipt },
  { href: "/subscriptions", label: "Subscriptions", icon: Repeat },
  { href: "/reports", label: "Reports", icon: ChartColumn },
  { href: "/assistant", label: "AI assistant", icon: Sparkles },
  { href: "/sandbox-payment", label: "Sandbox payment", icon: CreditCard },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/admin", label: "Admin", icon: ShieldCheck, adminOnly: true },
];

export { PiggyBank };
