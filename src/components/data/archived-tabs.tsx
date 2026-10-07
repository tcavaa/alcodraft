import { FilterTabs } from "@/components/data/filter-tabs";
import { formatQty } from "@/lib/money";
import type { SearchParams } from "@/lib/search-params";

/** "აქტიური / სანაგვე" switch of the customer, product, supplier and employee lists (`?archived=1`). */
export function ArchivedTabs({
  pathname,
  searchParams,
  archived,
  counts,
}: {
  pathname: string;
  searchParams: SearchParams;
  archived: boolean;
  counts: { active: number; archived: number };
}) {
  return (
    <FilterTabs
      pathname={pathname}
      searchParams={searchParams}
      param="archived"
      value={archived ? "1" : "0"}
      options={[
        { value: "0", label: "აქტიური", count: formatQty(counts.active) },
        { value: "1", label: "სანაგვე", count: formatQty(counts.archived) },
      ]}
    />
  );
}
