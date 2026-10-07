"use client";

import { Check, ChevronsUpDown, LogOut, Monitor, Moon, Store, Sun, UserRound } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";

import { Wordmark } from "@/components/brand/wordmark";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { logoutAction } from "@/features/auth/actions";

import { ADMIN_NAV, GLOBAL_NAV, STORE_NAV, storeHref } from "./nav";

export interface SidebarUser {
  name: string;
  email: string;
  role: "super_admin" | "user";
}

export interface SidebarStore {
  id: number;
  name: string;
  isArchived: boolean;
}

export function AppSidebar({ user, stores }: { user: SidebarUser; stores: SidebarStore[] }) {
  const pathname = usePathname();
  const params = useParams<{ storeId?: string }>();
  const current = stores.find((s) => String(s.id) === params.storeId) ?? null;

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-3 px-3 pt-4">
        <Link href="/admin" className="flex h-8 items-center px-1 group-data-[collapsible=icon]:justify-center">
          <Wordmark onDark className="text-[1.65rem] leading-none group-data-[collapsible=icon]:hidden" />
          <span className="hidden font-display text-xl font-bold text-sidebar-primary group-data-[collapsible=icon]:block">
            A
          </span>
        </Link>
        <StoreSwitcher stores={stores} current={current} pathname={pathname} />
      </SidebarHeader>

      <SidebarContent className="pb-4">
        {current
          ? STORE_NAV.map((group) => (
              <SidebarGroup key={group.label}>
                <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const href = storeHref(current.id, item.segment);
                    // "სალარო" must not stay highlighted on its "monthly" sub-page.
                    const exact = item.segment === "" || item.segment === "finance";
                    const active =
                      isActive(href, exact) ||
                      (item.segment === "finance" && pathname.startsWith(`${href}/`) && !pathname.startsWith(`${href}/monthly`));
                    return (
                      <SidebarMenuItem key={item.segment}>
                        <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                          <Link href={href}>
                            <item.icon />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroup>
            ))
          : null}

        <SidebarGroup>
          <SidebarGroupLabel>ზოგადი</SidebarGroupLabel>
          <SidebarMenu>
            {GLOBAL_NAV.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton asChild isActive={isActive(item.href, true)} tooltip={item.title}>
                  <Link href={item.href}>
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        {user.role === "super_admin" ? (
          <SidebarGroup>
            <SidebarGroupLabel>ადმინისტრირება</SidebarGroupLabel>
            <SidebarMenu>
              {ADMIN_NAV.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={isActive(item.href, false)} tooltip={item.title}>
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ) : null}
      </SidebarContent>

      <SidebarFooter className="pb-3">
        <UserMenu user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function StoreSwitcher({
  stores,
  current,
  pathname,
}: {
  stores: SidebarStore[];
  current: SidebarStore | null;
  pathname: string;
}) {
  const router = useRouter();
  const { isMobile } = useSidebar();
  // Keep the same section (e.g. "customers") when switching to another store.
  const section = current ? pathname.slice(storeHref(current.id).length + 1).split("/")[0] : "";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="border border-sidebar-border bg-sidebar-accent/50 data-[state=open]:bg-sidebar-accent"
              tooltip={current?.name ?? "მაღაზია"}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                <Store className="size-4" />
              </span>
              <span className="grid flex-1 text-left leading-tight">
                <span className="truncate text-[0.7rem] tracking-wide text-sidebar-foreground/55 uppercase">მაღაზია</span>
                <span className="truncate font-medium">{current?.name ?? "აირჩიეთ მაღაზია"}</span>
              </span>
              <ChevronsUpDown className="ml-auto size-4 opacity-60" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-64"
            side={isMobile ? "bottom" : "right"}
            align="start"
            sideOffset={6}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">მაღაზიები</DropdownMenuLabel>
            {stores.map((store) => (
              <DropdownMenuItem
                key={store.id}
                onSelect={() => router.push(storeHref(store.id, section))}
                className="gap-2"
              >
                <span className="flex-1 truncate">{store.name}</span>
                {store.isArchived ? <span className="text-xs text-muted-foreground">არქივი</span> : null}
                {store.id === current?.id ? <Check className="size-4" /> : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function UserMenu({ user }: { user: SidebarUser }) {
  const { isMobile } = useSidebar();
  const { theme, setTheme } = useTheme();
  const initials = (user.name || user.email).slice(0, 2).toUpperCase();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent" tooltip={user.email}>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold text-sidebar-primary ring-1 ring-sidebar-border">
                {initials}
              </span>
              <span className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name || user.email}</span>
                <span className="truncate text-xs text-sidebar-foreground/55">
                  {user.role === "super_admin" ? "სუპერ ადმინი" : user.email}
                </span>
              </span>
              <ChevronsUpDown className="ml-auto size-4 opacity-60" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={6}
          >
            <DropdownMenuLabel className="font-normal">
              <div className="truncate text-sm font-medium">{user.name || user.email}</div>
              <div className="truncate text-xs text-muted-foreground">{user.email}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href="/admin/account">
                  <UserRound />
                  ჩემი ანგარიში
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="gap-2">
                  <Sun className="size-4 dark:hidden" />
                  <Moon className="hidden size-4 dark:block" />
                  იერსახე
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
                    <DropdownMenuRadioItem value="light">
                      <Sun /> ნათელი
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="dark">
                      <Moon /> მუქი
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="system">
                      <Monitor /> სისტემური
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <form action={logoutAction}>
              <DropdownMenuItem asChild variant="destructive">
                <button type="submit" className="w-full">
                  <LogOut />
                  გასვლა
                </button>
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
