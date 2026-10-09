"use client";

import { Boxes, CornerDownLeft, Truck, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Spinner } from "@/components/ui/spinner";
import { type SearchHit, searchStoreAction } from "@/features/search/actions";

import { COMMAND_PALETTE_EVENT } from "./command-palette-events";
import { useCurrentStoreId } from "./use-current-store";
import { GLOBAL_NAV, STORE_NAV, storeHref } from "./nav";

const HIT_ICON = { customer: UserRound, product: Boxes, supplier: Truck } as const;
const HIT_PATH = { customer: "customers", product: "products", supplier: "suppliers" } as const;
const HIT_GROUP = { customer: "ობიექტები", product: "პროდუქცია", supplier: "მომწოდებლები" } as const;

export function CommandPalette() {
  const router = useRouter();
  const storeId = useCurrentStoreId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, startSearch] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(COMMAND_PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(COMMAND_PALETTE_EVENT, onOpen);
    };
  }, []);

  const searchable = Boolean(storeId) && query.trim().length >= 2;
  useEffect(() => {
    if (!storeId || query.trim().length < 2) return;
    const timer = setTimeout(() => {
      startSearch(async () => setHits(await searchStoreAction(storeId, query)));
    }, 180);
    return () => clearTimeout(timer);
  }, [query, storeId]);

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  const needle = query.trim().toLowerCase();
  const matches = (text: string) => !needle || text.toLowerCase().includes(needle);
  const storeNav = STORE_NAV.map((g) => ({ ...g, items: g.items.filter((i) => matches(i.title)) })).filter(
    (g) => g.items.length,
  );
  const globalNav = GLOBAL_NAV.filter((i) => matches(i.title));

  const groups = (["customer", "product", "supplier"] as const)
    .map((kind) => ({ kind, items: searchable ? hits.filter((h) => h.kind === kind) : [] }))
    .filter((g) => g.items.length);

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="ძებნა" description="იპოვეთ ობიექტი, პროდუქტი ან გვერდი">
      <Command shouldFilter={false}>
      <CommandInput
        placeholder={storeId ? "ობიექტი, პროდუქტი, მომწოდებელი ან გვერდი…" : "გვერდის ძებნა…"}
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-[420px]">
        <CommandEmpty>{searching ? <Spinner className="mx-auto" /> : "ვერაფერი მოიძებნა."}</CommandEmpty>

        {storeId && groups.length
          ? groups.map((g) => (
              <CommandGroup key={g.kind} heading={HIT_GROUP[g.kind]}>
                {g.items.map((hit) => {
                  const Icon = HIT_ICON[hit.kind];
                  return (
                    <CommandItem
                      key={`${hit.kind}-${hit.id}`}
                      value={`${hit.kind}-${hit.id}-${hit.title}`}
                      onSelect={() => go(storeHref(storeId, `${HIT_PATH[hit.kind]}/${hit.id}`))}
                    >
                      <Icon />
                      <div className="min-w-0 flex-1">
                        <div className="truncate">{hit.title}</div>
                        {hit.subtitle ? <div className="truncate text-xs text-muted-foreground">{hit.subtitle}</div> : null}
                      </div>
                      {hit.archived ? <span className="text-xs text-muted-foreground">არქივი</span> : null}
                      <CornerDownLeft className="opacity-40" />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))
          : null}

        {storeId ? (
          <>
            <CommandSeparator />
            {storeNav.map((group) => (
              <CommandGroup key={group.label} heading={group.label}>
                {group.items.map((item) => (
                  <CommandItem
                    key={item.segment}
                    value={`nav ${group.label} ${item.title}`}
                    onSelect={() => go(storeHref(storeId, item.segment))}
                  >
                    <item.icon />
                    {item.title}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </>
        ) : null}
        {globalNav.length ? (
        <CommandGroup heading="ზოგადი">
          {globalNav.map((item) => (
            <CommandItem key={item.href} value={`nav ${item.title}`} onSelect={() => go(item.href)}>
              <item.icon />
              {item.title}
            </CommandItem>
          ))}
        </CommandGroup>
        ) : null}
      </CommandList>
      </Command>
    </CommandDialog>
  );
}
