import { sum } from "@/lib/money";

/** Product categories (new). Products made before them have none („კატეგორიის გარეშე“). */
export const PRODUCT_CATEGORIES = ["draft", "bottle"] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const PRODUCT_CATEGORY_LABEL: Record<ProductCategory, string> = {
  draft: "ჩამოსასხმელი",
  bottle: "შუშა",
};

export const NO_CATEGORY_LABEL = "კატეგორიის გარეშე";

/** Units and money per category, then the total — for the best-sellers statistics. */
export function categoryTotals(rows: { category: ProductCategory | null; quantity: number; total: string }[]) {
  const keys = [...PRODUCT_CATEGORIES, null] as const;
  const groups = keys
    .map((key) => {
      const items = rows.filter((r) => r.category === key);
      return {
        key: key ?? ("none" as const),
        label: key ? PRODUCT_CATEGORY_LABEL[key] : NO_CATEGORY_LABEL,
        count: items.length,
        quantity: items.reduce((a, r) => a + r.quantity, 0),
        total: sum(items.map((r) => r.total)).toString(),
      };
    })
    // „კატეგორიის გარეშე“ only while some sold product still has none.
    .filter((g) => g.key !== "none" || g.count > 0);
  return {
    groups,
    quantity: rows.reduce((a, r) => a + r.quantity, 0),
    total: sum(rows.map((r) => r.total)).toString(),
  };
}
