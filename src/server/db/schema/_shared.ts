import { integer, numeric, pgSchema, timestamp } from "drizzle-orm/pg-core";

/**
 * Every application table lives in the `app` schema. Supabase's Data API only
 * exposes `public`, so nothing here is reachable with the publishable key; the
 * app talks to Postgres directly through the connection pooler.
 */
export const app = pgSchema("app");

export const userRole = app.enum("user_role", ["super_admin", "user"]);

/** `legacy_md5_bcrypt` = bcrypt(md5(password)) imported from the old PHP app; upgraded on first login. */
export const passwordScheme = app.enum("password_scheme", ["bcrypt", "legacy_md5_bcrypt"]);

/** `back` = settled by returned goods: lowers the customer's debt but never touches the cash ledger. */
export const paymentMethod = app.enum("payment_method", ["cash", "card", "back"]);

/** RS.ge waybill upload state (old values: ასატვირთი / ატვირთული). */
export const uploadStatus = app.enum("upload_status", ["pending", "uploaded"]);

export const orderStatus = app.enum("order_status", ["open", "completed", "cancelled"]);

/**
 * `adjustment` = a manual debt correction with no products.
 * `count` (განაშთვა, new) = leftovers counted on the customer's shelf: lines with only „ნაშთი“; no
 * stock, debt or cash effect.
 * `return` (პროდუქციის გამოტანა, new) = goods taken back from the customer: total = −Σ price × qty
 * lowers the debt, no cash entry; the goods go back into stock through the linked stock receipt.
 */
export const deliveryKind = app.enum("delivery_kind", ["delivery", "adjustment", "count", "return"]);

/** New values are appended (Postgres can add enum values but not reorder them); display order is in `CUSTOMER_COLORS`. */
export const customerColor = app.enum("customer_color", ["green", "yellow", "red", "blue", "black", "white"]);

export const financeEntryKind = app.enum("finance_entry_kind", [
  "manual",
  "delivery",
  "supplier_payment",
  "wage_payment",
]);

/** Exact money amount. The driver returns numeric as a string; do math with `@/lib/money`. */
export const money = () => numeric({ precision: 18, scale: 4 });

/** Discount multiplier, e.g. 0.85 = 15% off (old column `sale`). */
export const factor = () => numeric({ precision: 6, scale: 4 });

export const id = () => integer().primaryKey().generatedByDefaultAsIdentity();

export const createdAt = () =>
  timestamp({ withTimezone: true, mode: "date" }).notNull().defaultNow();

export const timestamps = () => ({
  createdAt: createdAt(),
  updatedAt: timestamp({ withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
