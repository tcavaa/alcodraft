/**
 * How the old copy-pasted table sets map onto stores.
 * Old admin menu: names.id 1 → tables without suffix, names.id 4 → "2" tables, …
 */
export interface LegacyFinanceBook {
  table: string;
  name: string;
  isDefault: boolean;
}

export interface LegacyStoreSet {
  key: string;
  /** Table-name suffix: drinks{suffix}, company{suffix}, … */
  suffix: string;
  /** Row in the old `names` table that holds the store's display name. */
  nameId: number;
  finance: LegacyFinanceBook[];
  /** Only the first store had employees / wages. */
  hasEmployees: boolean;
}

export const STORE_SETS: LegacyStoreSet[] = [
  {
    key: "set1",
    suffix: "",
    nameId: 1,
    finance: [
      { table: "finance", name: "ფინანსები", isDefault: true },
      { table: "finance2", name: "ფინანსები 2", isDefault: false },
    ],
    hasEmployees: true,
  },
  {
    key: "set2",
    suffix: "2",
    nameId: 4,
    finance: [
      { table: "finance3", name: "ფინანსები", isDefault: true },
      { table: "finance4", name: "ფინანსები 2", isDefault: false },
    ],
    hasEmployees: false,
  },
  {
    key: "set3",
    suffix: "3",
    nameId: 5,
    finance: [{ table: "finance5", name: "ფინანსები", isDefault: true }],
    hasEmployees: false,
  },
  {
    key: "set4",
    suffix: "4",
    nameId: 6,
    finance: [{ table: "finance7", name: "ფინანსები", isDefault: true }],
    hasEmployees: false,
  },
  {
    key: "set5",
    suffix: "5",
    nameId: 7,
    finance: [{ table: "finance9", name: "ფინანსები", isDefault: true }],
    hasEmployees: false,
  },
  {
    key: "set6",
    suffix: "6",
    nameId: 8,
    finance: [{ table: "finance11", name: "ფინანსები", isDefault: true }],
    hasEmployees: false,
  },
];

/** Users that saw only some stores in the old menu (views/admin/template.php). Everyone else saw all. */
export const USER_STORE_ACCESS: Record<string, string[]> = {
  "gealco@alcodraft.ge": ["set1", "set2"],
  "saojaxo@alcodraft.ge": ["set3", "set6"],
  "broweuli@alcodraft.ge": ["set4"],
  "akriani@alcodraft.ge": ["set5"],
};

export const SUPER_ADMIN_EMAILS = ["admin@alcodraft.ge"];

/** The "returned goods" supplier lists every product on its stock-receipt form. */
export const RETURNS_SUPPLIER_PATTERN = /დაბრუნებული/;

/** Placeholder text the old forms pre-filled into comment fields. */
export const DEFAULT_PLACEHOLDER_COMMENTS = new Set(["Comment"]);
