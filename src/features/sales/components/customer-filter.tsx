import { ParamCombobox } from "@/components/data/param-combobox";

import type { CustomerFilterOption } from "../queries";

/** "კლიენტი" filter of the operation and order lists (`?customer=<id>`). */
export function CustomerFilter({
  options,
  value,
  withStore = false,
  className,
}: {
  options: CustomerFilterOption[];
  value: number | undefined;
  /** Lists that span several stores show the store under each name. */
  withStore?: boolean;
  className?: string;
}) {
  return (
    <ParamCombobox
      param="customer"
      value={value ? String(value) : undefined}
      label="კლიენტი"
      placeholder="კლიენტის ძებნა…"
      emptyText="კლიენტი ვერ მოიძებნა."
      className={className}
      options={options.map((c) => ({
        value: String(c.id),
        label: c.name,
        hint:
          (withStore ? [c.storeName, c.address] : [c.address, c.isArchived ? "სანაგვე" : ""]).filter(Boolean).join(" · ") ||
          undefined,
        muted: c.isArchived,
      }))}
    />
  );
}
