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

/** A link outside the store pages. */
export interface NavLink {
  title: string;
  href: string;
  icon: LucideIcon;
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
      { title: "ობიექტები", segment: "customers", icon: Users },
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

export const GLOBAL_NAV: NavLink[] = [
  { title: "ყველა მაღაზია", href: "/admin", icon: Store },
  { title: "ყველა შეკვეთა", href: "/admin/orders", icon: ClipboardList },
];

export const ADMIN_NAV: NavLink[] = [
  { title: "მაღაზიები", href: "/admin/settings/stores", icon: Store },
  { title: "მომხმარებლები", href: "/admin/settings/users", icon: UserRoundCog },
  { title: "აუდიტი", href: "/admin/settings/audit", icon: ScrollText },
];

export { storeHref } from "@/lib/routes";
