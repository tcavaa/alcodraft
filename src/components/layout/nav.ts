import {
  Banknote,
  Boxes,
  CalendarRange,
  ClipboardList,
  LayoutDashboard,
  type LucideIcon,
  PackageOpen,
  ReceiptText,
  ScrollText,
  Store,
  Truck,
  Users,
  UserRoundCog,
  Wallet,
} from "lucide-react";

export interface NavItem {
  title: string;
  /** Path relative to /admin/stores/[storeId] ("" = store dashboard). */
  segment: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** Everything a store can do — identical for every store. */
export const STORE_NAV: NavGroup[] = [
  {
    label: "მიმოხილვა",
    items: [{ title: "დაფა", segment: "", icon: LayoutDashboard }],
  },
  {
    label: "გაყიდვები",
    items: [
      { title: "ოპერაციები", segment: "operations", icon: ReceiptText },
      { title: "შეკვეთები", segment: "orders", icon: ClipboardList },
      { title: "კლიენტები", segment: "customers", icon: Users },
    ],
  },
  {
    label: "საწყობი",
    items: [
      { title: "პროდუქცია", segment: "products", icon: Boxes },
      { title: "მიღება", segment: "stock", icon: PackageOpen },
      { title: "მომწოდებლები", segment: "suppliers", icon: Truck },
    ],
  },
  {
    label: "ფინანსები",
    items: [
      { title: "სალარო", segment: "finance", icon: Wallet },
      { title: "თვის ბრუნვა", segment: "finance/monthly", icon: CalendarRange },
      { title: "ხელფასები", segment: "employees", icon: Banknote },
    ],
  },
];

export const GLOBAL_NAV: (NavItem & { href: string })[] = [
  { title: "ყველა მაღაზია", segment: "", href: "/admin", icon: Store },
  { title: "ყველა შეკვეთა", segment: "", href: "/admin/orders", icon: ClipboardList },
];

export const ADMIN_NAV: (NavItem & { href: string })[] = [
  { title: "მაღაზიები", segment: "", href: "/admin/settings/stores", icon: Store },
  { title: "მომხმარებლები", segment: "", href: "/admin/settings/users", icon: UserRoundCog },
  { title: "აუდიტი", segment: "", href: "/admin/settings/audit", icon: ScrollText },
];

export { storeHref } from "@/lib/routes";
