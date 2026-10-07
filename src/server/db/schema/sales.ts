import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import {
  app,
  deliveryKind,
  factor,
  id,
  money,
  orderStatus,
  paymentMethod,
  timestamps,
  uploadStatus,
} from "./_shared";
import { stores, users } from "./auth";
import { customers, products } from "./catalog";

/**
 * Old: `distribution` — one "day closing" for a customer: goods delivered,
 * gifts, leftovers counted on the shelf and money collected.
 *
 * The customer's running debt is NOT stored. For any delivery it is
 *   SUM(total_amount - paid_amount + adjustment_amount)
 *     over that customer's deliveries ordered by id, up to and including it,
 * which is exactly the old `darchenili = fullamount + previous darchenili - money`.
 * `adjustment_amount` holds manual corrections (imported ones reproduce the
 * old stored values exactly; new ones come from the "debt correction" action).
 */
export const deliveries = app
  .table(
    "deliveries",
    {
      id: id(),
      storeId: integer()
        .notNull()
        .references(() => stores.id),
      customerId: integer()
        .notNull()
        .references(() => customers.id),
      /** Per-store document number; imported rows keep their old id. */
      number: integer().notNull(),
      kind: deliveryKind().notNull().default("delivery"),
      deliveryDate: date({ mode: "string" }).notNull(),
      /** Sum of line totals (old `fullamount`). */
      totalAmount: money().notNull().default("0"),
      /** Money taken from the customer (old `money`). */
      paidAmount: money().notNull().default("0"),
      adjustmentAmount: money().notNull().default("0"),
      paymentMethod: paymentMethod(),
      /** Old `zedna` (ზედნადები) yes/no. */
      hasWaybill: boolean(),
      /** Old `sale`: 1 = no discount, 0.85 = 15% off. */
      discountFactor: factor(),
      uploadStatus: uploadStatus(),
      comment: text().notNull().default(""),
      /** Raw values from the old system that were not clean numbers. */
      legacy: jsonb(),
      createdById: integer().references(() => users.id, { onDelete: "set null" }),
      ...timestamps(),
    },
    (t) => [
      uniqueIndex().on(t.storeId, t.number),
      index().on(t.customerId, t.id),
      index().on(t.storeId, t.deliveryDate),
    ],
  )
  .enableRLS();

/** Old: `drinks_count` (only rows with a non-zero quantity are kept). */
export const deliveryItems = app
  .table(
    "delivery_items",
    {
      id: id(),
      deliveryId: integer()
        .notNull()
        .references(() => deliveries.id, { onDelete: "cascade" }),
      productId: integer()
        .notNull()
        .references(() => products.id),
      /** Final unit price, discount already applied (old `drink_price`). */
      unitPrice: money().notNull(),
      /** Delivered (შეტანილი, old `drink_in`). Charged and taken from stock. */
      quantity: integer().notNull().default(0),
      /** Gift (საჩუქარი, old `drink_gift`). Taken from stock, not charged. */
      giftQty: integer().notNull().default(0),
      /** Left on the customer's shelf (ნაშთი, old `drink_out`). Informational only. */
      leftoverQty: integer().notNull().default(0),
      /** quantity × unitPrice (old `drink_sum`). */
      lineTotal: money().notNull(),
    },
    (t) => [index().on(t.deliveryId), index().on(t.productId)],
  )
  .enableRLS();

/**
 * Old: `orders`. An order does not touch stock or money until it is completed;
 * completing it creates a delivery with the same lines.
 */
export const orders = app
  .table(
    "orders",
    {
      id: id(),
      storeId: integer()
        .notNull()
        .references(() => stores.id),
      customerId: integer()
        .notNull()
        .references(() => customers.id),
      number: integer().notNull(),
      orderDate: date({ mode: "string" }).notNull(),
      status: orderStatus().notNull().default("open"),
      totalAmount: money().notNull().default("0"),
      paidAmount: money().notNull().default("0"),
      /** Customer's debt when the order was created (old `orders.darchenili`). */
      debtSnapshot: money().notNull().default("0"),
      paymentMethod: paymentMethod(),
      hasWaybill: boolean(),
      discountFactor: factor(),
      uploadStatus: uploadStatus(),
      comment: text().notNull().default(""),
      deliveryId: integer().references(() => deliveries.id, { onDelete: "set null" }),
      completedAt: timestamp({ withTimezone: true, mode: "date" }),
      cancelledAt: timestamp({ withTimezone: true, mode: "date" }),
      legacy: jsonb(),
      createdById: integer().references(() => users.id, { onDelete: "set null" }),
      ...timestamps(),
    },
    (t) => [
      uniqueIndex().on(t.storeId, t.number),
      index().on(t.storeId, t.status, t.id),
      index().on(t.customerId),
    ],
  )
  .enableRLS();

/** Old: `drinks_count_orders`. */
export const orderItems = app
  .table(
    "order_items",
    {
      id: id(),
      orderId: integer()
        .notNull()
        .references(() => orders.id, { onDelete: "cascade" }),
      productId: integer()
        .notNull()
        .references(() => products.id),
      unitPrice: money().notNull(),
      quantity: integer().notNull().default(0),
      giftQty: integer().notNull().default(0),
      leftoverQty: integer().notNull().default(0),
      lineTotal: money().notNull(),
    },
    (t) => [index().on(t.orderId), index().on(t.productId)],
  )
  .enableRLS();
