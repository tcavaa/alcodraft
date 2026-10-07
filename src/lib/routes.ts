/** URL builders shared by pages, components and Server Actions. */
export function storeHref(storeId: number | string, segment = ""): string {
  return segment ? `/admin/stores/${storeId}/${segment}` : `/admin/stores/${storeId}`;
}
