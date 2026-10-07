import type { Metadata } from "next";
import { Suspense } from "react";

import { CommandPalette } from "@/components/layout/command-palette";
import { SidebarLoader, SidebarSkeleton } from "@/components/layout/sidebar-loader";
import { Topbar } from "@/components/layout/topbar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <Suspense fallback={<SidebarSkeleton />}>
        <SidebarLoader />
      </Suspense>
      <SidebarInset className="min-w-0">
        <Topbar />
        <div className="mx-auto w-full max-w-[1500px] flex-1 px-4 pt-6 pb-16 md:px-8">{children}</div>
      </SidebarInset>
      {/* Reads the URL (current store) — streams in after the static shell. */}
      <Suspense fallback={null}>
        <CommandPalette />
      </Suspense>
    </SidebarProvider>
  );
}
