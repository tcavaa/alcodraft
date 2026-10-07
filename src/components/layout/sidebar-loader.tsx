import { Sidebar, SidebarContent, SidebarHeader } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { getMyStores, requireUser } from "@/server/auth/dal";

import { AppSidebar } from "./app-sidebar";

/** Reads the session, so it renders inside <Suspense> (see the admin layout). */
export async function SidebarLoader() {
  const user = await requireUser();
  const stores = await getMyStores();
  return <AppSidebar user={{ name: user.name, email: user.email, role: user.role }} stores={stores} />;
}

// Fixed widths: the prerendered shell must be deterministic (no Math.random()).
const SKELETON_WIDTHS = ["62%", "78%", "54%", "70%", "66%", "58%", "74%", "60%", "68%"];

export function SidebarSkeleton() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-3 px-3 pt-4">
        <Skeleton className="h-8 w-32 bg-sidebar-accent" />
        <Skeleton className="h-12 w-full bg-sidebar-accent" />
      </SidebarHeader>
      <SidebarContent className="gap-1 px-2 pt-4">
        {SKELETON_WIDTHS.map((width, i) => (
          <div key={i} className="flex h-8 items-center gap-2 px-2">
            <Skeleton className="size-4 rounded-md bg-sidebar-accent" />
            <Skeleton className="h-4 bg-sidebar-accent" style={{ width }} />
          </div>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
