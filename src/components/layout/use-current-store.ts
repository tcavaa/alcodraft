"use client";

import { usePathname } from "next/navigation";

/**
 * The store whose pages are open (`/admin/stores/<id>/…`), or null. Read from the path, not the
 * `storeId` route param: the store settings page (`/admin/settings/stores/<id>`) uses the same
 * param name but is not "inside" that store.
 */
export function useCurrentStoreId(): number | null {
  const match = /^\/admin\/stores\/(\d+)(?:\/|$)/.exec(usePathname());
  return match ? Number(match[1]) : null;
}
