"use client";

import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

import { openCommandPalette } from "./command-palette-events";

export function Topbar() {
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur-md md:px-6 print:hidden">
      <SidebarTrigger className="-ml-1.5" />
      <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-5" />
      <Button
        variant="outline"
        // min-w-0 + shrink: the button variant is shrink-0, which pushed it past a phone's edge.
        className="h-9 w-full max-w-sm min-w-0 shrink justify-start gap-2 bg-card text-muted-foreground shadow-none"
        onClick={openCommandPalette}
      >
        <Search className="size-4" />
        <span className="truncate">ძებნა — ობიექტი, პროდუქტი, გვერდი…</span>
        <Kbd className="ml-auto hidden sm:inline-flex">⌘K</Kbd>
      </Button>
    </header>
  );
}
