/**
 * End-to-end business flows against a real Postgres, each inside ONE transaction that is always
 * rolled back (nothing is left behind). Runs only when TEST_DATABASE_URL points at a disposable
 * database (local Postgres or a Supabase branch) — never at production through .env.local:
 *
 *   TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/alcodraft_test npm test
 */
import { randomUUID } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { afterAll, describe, expect, it } from "vitest";

import { dec } from "@/lib/money";
import { ActionError } from "@/server/action";
import type { Tx } from "@/server/db";
import { customerDebt } from "@/server/db/helpers";
import { once } from "@/server/db/once";
import { createPool } from "@/server/db/pool";
import * as s from "@/server/db/schema";

import { createStore } from "../admin/service";
import {
  adjustProductStock,
  createCustomer,
  createProduct,
  createSupplier,
  deleteSupplier,
  setProductActive,
  setProductArchived,
} from "../catalog/service";
import { accrueWage, createEmployee, deleteEntry, paySupplier, payWage, updateEmployee } from "../finance/service";
import { createReceipt, deleteReceipt } from "../stock/service";
import {
  completeOrder,
  createCustomerCount,
  createCustomerReturn,
  createDebtAdjustment,
  createDelivery,
  createOrder,
  deleteDelivery,
  setOrderQuickFields,
  updateDelivery,
} from "./service";

const url = process.env.TEST_DATABASE_URL;
const enabled = Boolean(url);

class Rollback extends Error {}

describe.skipIf(!enabled)("money & stock flows (rolled back)", () => {
  const pool = enabled ? createPool(url, { max: 1 }) : null;
  const db = pool ? drizzle({ client: pool, schema: s, casing: "snake_case" }) : null;
  afterAll(async () => {
    await pool?.end();
  });

  /** Runs `body` with a fresh store and super admin, then rolls everything back. */
  async function inRollback(body: (tx: Tx, ctx: Awaited<ReturnType<typeof setup>>) => Promise<void>) {
    const run = db!.transaction(async (tx) => {
      await body(tx, await setup(tx));
      throw new Rollback();
    });
    await expect(run).rejects.toBeInstanceOf(Rollback);
  }

  async function setup(tx: Tx) {
    const [user] = await tx
      .insert(s.users)
      .values({ email: `flow-test-${randomUUID()}@example.invalid`, passwordHash: "x", role: "super_admin" })
      .returning({ id: s.users.id });
    const store = await createStore(tx, user.id, { name: "TEST STORE" });
    const actor = { userId: user.id, storeId: store.id };
    return {
      user,
      store,
      actor,
      stock: async (productId: number) =>
        (await tx.select({ q: s.products.stockQty }).from(s.products).where(eq(s.products.id, productId)))[0].q,
      cash: async () =>
        dec(
          (
            await tx
              .select({
                b: sql<string>`coalesce(sum(${s.financeEntries.amountIn} - ${s.financeEntries.amountOut} + ${s.financeEntries.adjustmentAmount}), 0)`,
              })
              .from(s.financeEntries)
              .where(eq(s.financeEntries.storeId, store.id))
          )[0].b,
        ).toString(),
      debt: async (customerId: number) => (await customerDebt(tx, customerId)).toString(),
      delivery: async (id: number) => (await tx.select().from(s.deliveries).where(eq(s.deliveries.id, id)))[0],
    };
  }

  const fails = (promise: Promise<unknown>) => expect(promise).rejects.toBeInstanceOf(ActionError);
  /** A failing step in its own savepoint, so the surrounding test transaction stays usable. */
  const failsInSavepoint = (tx: Tx, step: (inner: Tx) => Promise<unknown>) => fails(tx.transaction(step));

  it("keeps stock, customer debt and the cash book consistent", async () => {
    await inRollback(async (tx, { actor, stock, cash, debt, delivery }) => {
      // Catalog + receipt (old drinks/stock): stock grows, receipt keeps stock-before.
      const supplier = await createSupplier(tx, actor, { name: "S", isReturns: false });
      const p1 = await createProduct(tx, actor, { name: "Wine A", supplierId: supplier.id, salePrice: dec(17), purchasePrice: dec(10), comment: "" });
      const p2 = await createProduct(tx, actor, { name: "Wine B", supplierId: supplier.id, salePrice: dec(20), purchasePrice: dec(12), comment: "" });
      await createReceipt(tx, actor, {
        supplierId: supplier.id,
        lines: [
          { productId: p1.id, quantity: 10, unitCost: dec(10) },
          { productId: p2.id, quantity: 5, unitCost: dec(12) },
        ],
        comment: "",
      });
      expect(await stock(p1.id)).toBe(10);
      expect(await stock(p2.id)).toBe(5);

      // Operation with 15% discount (old distribution/add).
      const customer = await createCustomer(tx, actor, { name: "C", address: "", taxId: "", phone: "", contactPerson: "" });
      const d1 = await createDelivery(tx, actor, {
        customerId: customer.id,
        lines: [
          { productId: p1.id, price: "17", quantity: 3, giftQty: 1, leftoverQty: 0 },
          { productId: p2.id, price: "20", quantity: 2, giftQty: 0, leftoverQty: 1 },
        ],
        discountFactor: "0.85",
        paidAmount: dec(30),
        paymentMethod: "cash",
        hasWaybill: true,
        comment: "",
      });
      expect(dec((await delivery(d1.id)).totalAmount).toString()).toBe("77.35"); // 3×14.45 + 2×17
      expect(await stock(p1.id)).toBe(6); // −3 −1 gift
      expect(await stock(p2.id)).toBe(3);
      expect(await debt(customer.id)).toBe("47.35");
      expect(await cash()).toBe("30");

      // Delivered quantity may not exceed stock (old form max=count).
      await failsInSavepoint(tx, (inner) =>
        createDelivery(inner, actor, {
          customerId: customer.id,
          lines: [{ productId: p1.id, price: "17", quantity: 7, giftQty: 0, leftoverQty: 0 }],
          discountFactor: "1",
          paidAmount: dec(0),
          paymentMethod: "cash",
          hasWaybill: true,
          comment: "",
        }),
      );

      // Payment only (card) and a "back" payment (debt drops, cash doesn't).
      await createDelivery(tx, actor, { customerId: customer.id, lines: [], discountFactor: "1", paidAmount: dec(20), paymentMethod: "card", hasWaybill: false, comment: "" });
      await createDelivery(tx, actor, { customerId: customer.id, lines: [], discountFactor: "1", paidAmount: dec(5), paymentMethod: "back", hasWaybill: false, comment: "" });
      expect(await debt(customer.id)).toBe("22.35");
      expect(await cash()).toBe("50");

      // Edit the first operation: stock, debt and its cash entry follow.
      await updateDelivery(tx, actor, d1.id, {
        lines: [
          { productId: p1.id, unitPrice: "14.45", quantity: 2, giftQty: 1, leftoverQty: 0 },
          { productId: p2.id, unitPrice: "17", quantity: 2, giftQty: 0, leftoverQty: 1 },
        ],
        paidAmount: dec(40),
        paymentMethod: "cash",
        hasWaybill: true,
        comment: "edited",
      });
      expect(await stock(p1.id)).toBe(7);
      expect(await debt(customer.id)).toBe("-2.1"); // 62.9 − 40 − 20 − 5
      expect(await cash()).toBe("60");

      // Manual correction brings the debt to zero.
      await createDebtAdjustment(tx, actor, { customerId: customer.id, amount: dec("2.1"), comment: "test" });
      expect(await debt(customer.id)).toBe("0");

      // Order → complete (no stock check) → delete the operation (order reopens, stock back).
      const order = await createOrder(tx, actor, {
        customerId: customer.id,
        lines: [{ productId: p2.id, price: "20", quantity: 10, giftQty: 0, leftoverQty: 0 }],
        discountFactor: "1",
        paidAmount: dec(0),
        paymentMethod: "cash",
        hasWaybill: true,
        comment: "",
        uploadStatus: "pending",
      });
      expect(await stock(p2.id)).toBe(3);
      const fromOrder = await completeOrder(tx, actor, order.id);
      expect(await stock(p2.id)).toBe(-7);
      expect(await debt(customer.id)).toBe("200");
      await deleteDelivery(tx, actor, fromOrder.id, "delivery");
      expect(await stock(p2.id)).toBe(3);
      expect(await debt(customer.id)).toBe("0");
      const [reopened] = await tx.select().from(s.orders).where(eq(s.orders.id, order.id));
      expect(reopened.status).toBe("open");

      // Supplier payment and wages go through the cash book.
      await paySupplier(tx, actor, { supplierId: supplier.id, amount: dec(100), note: "" });
      const employee = await createEmployee(tx, actor, { name: "E", wageBalance: dec(0) });
      await accrueWage(tx, actor, { employeeId: employee.id, amount: dec(500), comment: "" });
      await payWage(tx, actor, { employeeId: employee.id, amount: dec(200), note: "" });
      const [emp] = await tx.select().from(s.employees).where(eq(s.employees.id, employee.id));
      expect(dec(emp.wageBalance).toString()).toBe("300");
      expect(await cash()).toBe("-240"); // 60 − 100 − 200
    });
  });

  it("edits and deletes of imported operations keep old totals and corrections", async () => {
    await inRollback(async (tx, { store, actor, stock, cash, debt, delivery }) => {
      const p1 = await createProduct(tx, actor, { name: "A", supplierId: null, salePrice: dec(17), purchasePrice: dec(0), comment: "" });
      const p2 = await createProduct(tx, actor, { name: "B", supplierId: null, salePrice: dec(20), purchasePrice: dec(0), comment: "" });
      const p3 = await createProduct(tx, actor, { name: "C", supplierId: null, salePrice: dec(5), purchasePrice: dec(0), comment: "" });
      const archived = await createProduct(tx, actor, { name: "Old", supplierId: null, salePrice: dec(9), purchasePrice: dec(0), comment: "" });
      await setProductArchived(tx, actor, archived.id, true);
      await createReceipt(tx, actor, {
        supplierId: null,
        lines: [
          { productId: p1.id, quantity: 10, unitCost: dec(1) },
          { productId: p2.id, quantity: 10, unitCost: dec(1) },
        ],
        comment: "",
      });
      const customer = await createCustomer(tx, actor, { name: "Imported", address: "", taxId: "", phone: "", contactPerson: "" });

      // What the legacy import produces: stored total 500 while the rows add up to 480, a product
      // on two rows, a line total that isn't price × qty, a money-only row, no payment method, no
      // waybill flag and an old manual debt correction of −50.
      const [imported] = await tx
        .insert(s.deliveries)
        .values({
          storeId: store.id,
          customerId: customer.id,
          number: 9001,
          kind: "delivery",
          deliveryDate: "2024-01-05",
          totalAmount: "500",
          paidAmount: "100",
          adjustmentAmount: "-50",
          paymentMethod: null,
          hasWaybill: null,
        })
        .returning({ id: s.deliveries.id });
      await tx.insert(s.deliveryItems).values([
        { deliveryId: imported.id, productId: p1.id, unitPrice: "17", quantity: 10, lineTotal: "170" },
        { deliveryId: imported.id, productId: p1.id, unitPrice: "17", quantity: 5, lineTotal: "85" },
        { deliveryId: imported.id, productId: p2.id, unitPrice: "20", quantity: 10, lineTotal: "205" },
        { deliveryId: imported.id, productId: p3.id, unitPrice: "5", quantity: 0, lineTotal: "20" },
      ]);
      const later = await createDelivery(tx, actor, {
        customerId: customer.id,
        lines: [{ productId: p2.id, price: "20", quantity: 1, giftQty: 0, leftoverQty: 0 }],
        discountFactor: "1",
        paidAmount: dec(0),
        paymentMethod: "cash",
        hasWaybill: true,
        comment: "",
      });
      expect(await debt(customer.id)).toBe("370"); // 500 − 100 − 50 + 20
      const cashBefore = await cash();
      const itemIds = async () =>
        (await tx.select({ id: s.deliveryItems.id }).from(s.deliveryItems).where(eq(s.deliveryItems.deliveryId, imported.id)))
          .map((r) => r.id)
          .sort((a, b) => a - b);
      const idsBefore = await itemIds();

      // What the edit form sends unchanged: one line per product, as shown.
      const shown = [
        { productId: p1.id, unitPrice: "17", quantity: 15, giftQty: 0, leftoverQty: 0 },
        { productId: p2.id, unitPrice: "20", quantity: 10, giftQty: 0, leftoverQty: 0 },
        { productId: p3.id, unitPrice: "5", quantity: 0, giftQty: 0, leftoverQty: 0 },
      ];
      const edit = { paidAmount: dec(100), paymentMethod: null, hasWaybill: null, comment: "typo fixed" } as const;

      // Fixing the comment changes nothing else: total, rows, debt, cash book, empty method/waybill.
      await updateDelivery(tx, actor, imported.id, { ...edit, lines: shown });
      const afterComment = await delivery(imported.id);
      expect(dec(afterComment.totalAmount).toString()).toBe("500");
      expect(afterComment.paymentMethod).toBeNull();
      expect(afterComment.hasWaybill).toBeNull();
      expect(afterComment.comment).toBe("typo fixed");
      expect(await itemIds()).toEqual(idsBefore);
      expect(await debt(customer.id)).toBe("370");
      expect(await cash()).toBe(cashBefore);

      // Changing one product re-prices only that product; the old difference stays.
      const stockB = await stock(p2.id);
      await updateDelivery(tx, actor, imported.id, {
        ...edit,
        lines: shown.map((l) => (l.productId === p2.id ? { ...l, quantity: 8 } : l)),
      });
      expect(dec((await delivery(imported.id)).totalAmount).toString()).toBe("455"); // 500 − 205 + 160
      expect(await stock(p2.id)).toBe(stockB + 2);
      expect(await debt(customer.id)).toBe("325");

      // An edit follows the rules of a new operation for what it adds.
      const current = shown.map((l) => (l.productId === p2.id ? { ...l, quantity: 8 } : l));
      const onHand = await stock(p1.id);
      await failsInSavepoint(tx, (inner) =>
        updateDelivery(inner, actor, imported.id, {
          ...edit,
          lines: current.map((l) => (l.productId === p1.id ? { ...l, quantity: 15 + onHand + 1 } : l)),
        }),
      ); // delivers more on top of the saved 15 than there is in stock
      await failsInSavepoint(tx, (inner) =>
        updateDelivery(inner, actor, imported.id, {
          ...edit,
          lines: [...current, { productId: archived.id, unitPrice: "9", quantity: 1, giftQty: 0, leftoverQty: 0 }],
        }),
      ); // archived product
      await failsInSavepoint(tx, (inner) =>
        updateDelivery(inner, actor, imported.id, {
          ...edit,
          paidAmount: dec(0),
          lines: [...current.map((l) => ({ ...l, quantity: 0 })), { productId: p3.id, unitPrice: "6", quantity: 0, giftQty: 0, leftoverQty: 0 }],
        }),
      ); // nothing left (money-only row re-priced = removed) and nothing paid = a delete
      await failsInSavepoint(tx, (inner) =>
        updateDelivery(inner, actor, later.id, {
          lines: [{ productId: p2.id, unitPrice: "20", quantity: 1, giftQty: 0, leftoverQty: 0 }],
          paidAmount: dec(0),
          paymentMethod: null,
          hasWaybill: true,
          comment: "",
        }),
      ); // a set method can't be removed

      // Deleting keeps the old −50 correction as its own row in the same place.
      await deleteDelivery(tx, actor, imported.id, "delivery");
      const kept = await delivery(imported.id);
      expect(kept).toMatchObject({ kind: "adjustment", number: 9001 });
      expect(dec(kept.adjustmentAmount).toString()).toBe("-50");
      expect(dec(kept.totalAmount).isZero() && dec(kept.paidAmount).isZero()).toBe(true);
      expect(await itemIds()).toEqual([]);
      expect(await debt(customer.id)).toBe("-30"); // −50 + 20 (the later operation)
      expect(await cash()).toBe(dec(cashBefore).minus(100).toString()); // unlinked legacy payment reversed

      // A second delete of what the person saw as an operation (another tab) must not remove it.
      await failsInSavepoint(tx, (inner) => deleteDelivery(inner, actor, imported.id, "delivery"));
      expect(await delivery(imported.id)).toBeDefined();

      // Deleting the correction row itself removes it for good.
      await deleteDelivery(tx, actor, imported.id, "adjustment");
      expect(await delivery(imported.id)).toBeUndefined();
      expect(await debt(customer.id)).toBe("20");

      // An imported operation whose LINKED cash entry carries an old correction keeps that
      // correction when the payment leaves the cash book (here: switched to „დაბრუნება“).
      const [linkedOp] = await tx
        .insert(s.deliveries)
        .values({ storeId: store.id, customerId: customer.id, number: 9002, kind: "delivery", deliveryDate: "2024-02-01", totalAmount: "0", paidAmount: "100", paymentMethod: "cash" })
        .returning({ id: s.deliveries.id });
      const [account] = await tx.select().from(s.financeAccounts).where(eq(s.financeAccounts.storeId, store.id));
      const [linkedCash] = await tx
        .insert(s.financeEntries)
        .values({ storeId: store.id, accountId: account.id, entryDate: "2024-02-01", kind: "delivery", amountIn: "100", adjustmentAmount: "15", description: "Imported cash", deliveryId: linkedOp.id })
        .returning({ id: s.financeEntries.id });
      const beforeBack = await cash();
      await updateDelivery(tx, actor, linkedOp.id, { lines: [], paidAmount: dec(100), paymentMethod: "back", hasWaybill: null, comment: "" });
      expect(await cash()).toBe(dec(beforeBack).minus(100).toString()); // the payment left, the +15 stayed
      const [keptCash] = await tx.select().from(s.financeEntries).where(eq(s.financeEntries.id, linkedCash.id));
      expect(keptCash).toMatchObject({ kind: "manual", deliveryId: null });
      expect(dec(keptCash.adjustmentAmount).toString()).toBe("15");
    });
  });

  it("books a resubmitted create once", async () => {
    await inRollback(async (tx, { user, actor }) => {
      const customer = await createCustomer(tx, actor, { name: "Twice", address: "", taxId: "", phone: "", contactPerson: "" });
      const input = {
        customerId: customer.id,
        lines: [],
        discountFactor: "1",
        paidAmount: dec(10),
        paymentMethod: "cash" as const,
        hasWaybill: false,
        comment: "",
      };
      const request = { key: randomUUID(), action: "delivery.create", userId: user.id };
      const first = await once(tx, request, (t) => createDelivery(t, actor, input));
      const second = await once(tx, request, (t) => createDelivery(t, actor, input));
      expect(second).toEqual(first);
      const rows = await tx.select().from(s.deliveries).where(eq(s.deliveries.customerId, customer.id));
      expect(rows).toHaveLength(1);
      await fails(once(tx, { ...request, action: "order.create" }, (t) => createDelivery(t, actor, input))); // key of another action

      // A request that failed leaves its key free for the retry.
      const retry = { key: randomUUID(), action: "delivery.create", userId: user.id };
      await fails(once(tx, retry, (t) => createDelivery(t, actor, { ...input, paidAmount: dec(0) })));
      await once(tx, retry, (t) => createDelivery(t, actor, input));
      expect(await tx.select().from(s.deliveries).where(eq(s.deliveries.customerId, customer.id))).toHaveLength(2);
    });
  });

  it("guards the remaining money and stock edits", async () => {
    await inRollback(async (tx, { store, actor, stock, cash, delivery }) => {
      // Wage balance: saving the form never undoes a payment made since it was opened.
      const employee = await createEmployee(tx, actor, { name: "E", wageBalance: dec(500) });
      await payWage(tx, actor, { employeeId: employee.id, amount: dec(200), note: "" });
      const balance = async () => dec((await tx.select().from(s.employees).where(eq(s.employees.id, employee.id)))[0].wageBalance).toString();
      await updateEmployee(tx, actor, employee.id, { name: "E2", wageBalance: dec(500), wageBalanceBefore: dec(500) });
      expect(await balance()).toBe("300"); // name changed, balance kept
      await failsInSavepoint(tx, (inner) =>
        updateEmployee(inner, actor, employee.id, { name: "E2", wageBalance: dec(450), wageBalanceBefore: dec(500) }),
      );
      await updateEmployee(tx, actor, employee.id, { name: "E2", wageBalance: dec(250), wageBalanceBefore: dec(300) });
      expect(await balance()).toBe("250");

      // Inventory count against a stale screen is refused.
      const p = await createProduct(tx, actor, { name: "P", supplierId: null, salePrice: dec(10), purchasePrice: dec(0), comment: "" });
      await createReceipt(tx, actor, { supplierId: null, lines: [{ productId: p.id, quantity: 50, unitCost: dec(1) }], comment: "" });
      await failsInSavepoint(tx, (inner) => adjustProductStock(inner, actor, p.id, { newQty: 8, expectedQty: 0, reason: "count" }));
      await adjustProductStock(tx, actor, p.id, { newQty: 48, expectedQty: 50, reason: "count" });
      expect(await stock(p.id)).toBe(48);

      // A supplier with payments can't be hard-deleted (its payments would lose their link).
      const supplier = await createSupplier(tx, actor, { name: "Paid", isReturns: false });
      await paySupplier(tx, actor, { supplierId: supplier.id, amount: dec(5), note: "" });
      await failsInSavepoint(tx, (inner) => deleteSupplier(inner, actor, supplier.id));

      // "Complete" saves the changes still on screen first, in the same transaction.
      const customer = await createCustomer(tx, actor, { name: "O", address: "", taxId: "", phone: "", contactPerson: "" });
      const order = await createOrder(tx, actor, {
        customerId: customer.id,
        lines: [{ productId: p.id, price: "10", quantity: 4, giftQty: 0, leftoverQty: 0 }],
        discountFactor: "1",
        paidAmount: dec(0),
        paymentMethod: "cash",
        hasWaybill: true,
        comment: "",
        uploadStatus: "pending",
      });
      const done = await completeOrder(tx, actor, order.id, {
        lines: [{ productId: p.id, unitPrice: "10", quantity: 3, giftQty: 0, leftoverQty: 0 }],
        paidAmount: dec(30),
        paymentMethod: "card",
        hasWaybill: true,
        comment: "",
        uploadStatus: "pending",
      });
      const completed = await delivery(done.id);
      expect(dec(completed.totalAmount).toString()).toBe("30");
      expect(completed.paymentMethod).toBe("card");
      expect(await stock(p.id)).toBe(45);

      // The RS status of a completed order is kept in step with its operation.
      await setOrderQuickFields(tx, actor, order.id, { uploadStatus: "uploaded" });
      expect((await delivery(done.id)).uploadStatus).toBe("uploaded");

      // Deleting an imported cash entry that carries an old correction keeps the correction.
      const [account] = await tx.select().from(s.financeAccounts).where(eq(s.financeAccounts.storeId, store.id));
      const before = await cash();
      const [entry] = await tx
        .insert(s.financeEntries)
        .values({ storeId: store.id, accountId: account.id, entryDate: "2024-01-05", amountOut: "40", adjustmentAmount: "7", description: "old" })
        .returning({ id: s.financeEntries.id });
      expect(await cash()).toBe(dec(before).minus(33).toString());
      await deleteEntry(tx, actor, entry.id, "entry");
      expect(await cash()).toBe(dec(before).plus(7).toString());
      const [left] = await tx.select().from(s.financeEntries).where(and(eq(s.financeEntries.id, entry.id), eq(s.financeEntries.storeId, store.id)));
      expect(dec(left.adjustmentAmount).toString()).toBe("7");
      // A second delete confirmed as "the entry" (another tab) doesn't remove the kept correction…
      await failsInSavepoint(tx, (inner) => deleteEntry(inner, actor, entry.id, "entry"));
      // …deleting the correction row itself does.
      await deleteEntry(tx, actor, entry.id, "correction");
      expect(await cash()).toBe(before);
    });
  });

  it("counts leftovers, takes goods back from a customer and hides inactive products", async () => {
    await inRollback(async (tx, { actor, store, stock, cash, debt, delivery }) => {
      const returns = await createSupplier(tx, actor, { name: "დაბრუნებული", isReturns: true });
      const p1 = await createProduct(tx, actor, { name: "Wine A", supplierId: null, salePrice: dec(10), purchasePrice: dec(6), comment: "" });
      const p2 = await createProduct(tx, actor, { name: "Wine B", supplierId: null, salePrice: dec(20), purchasePrice: dec(12), comment: "" });
      await createReceipt(tx, actor, {
        supplierId: null,
        lines: [
          { productId: p1.id, quantity: 50, unitCost: dec(6) },
          { productId: p2.id, quantity: 50, unitCost: dec(12) },
        ],
        comment: "",
      });
      const customer = await createCustomer(tx, actor, { name: "Shop", address: "", taxId: "", phone: "", contactPerson: "" });
      await createDelivery(tx, actor, {
        customerId: customer.id,
        lines: [
          { productId: p1.id, price: "10", quantity: 12, giftQty: 0, leftoverQty: 0 },
          { productId: p2.id, price: "20", quantity: 6, giftQty: 0, leftoverQty: 0 },
        ],
        discountFactor: "1",
        paidAmount: dec(0),
        paymentMethod: "cash",
        hasWaybill: false,
        comment: "",
      });
      expect(await debt(customer.id)).toBe("240");
      const cashBefore = await cash();

      // „განაშთვა“: only leftovers — no stock, debt or cash change; zero counts aren't stored.
      const count = await createCustomerCount(tx, actor, {
        customerId: customer.id,
        lines: [
          { productId: p1.id, unitPrice: dec(10), leftoverQty: 4 },
          { productId: p2.id, unitPrice: dec(20), leftoverQty: 0 },
        ],
        comment: "",
      });
      expect((await delivery(count.id)).kind).toBe("count");
      const countItems = await tx.select().from(s.deliveryItems).where(eq(s.deliveryItems.deliveryId, count.id));
      expect(countItems.map((i) => [i.productId, i.quantity, i.leftoverQty, i.lineTotal])).toEqual([[p1.id, 0, 4, "0.0000"]]);
      expect([await stock(p1.id), await stock(p2.id), await debt(customer.id), await cash()]).toEqual([38, 44, "240", cashBefore]);
      await failsInSavepoint(tx, (inner) =>
        updateDelivery(inner, actor, count.id, { lines: [], paidAmount: dec(5), paymentMethod: "cash", hasWaybill: null, comment: "" }),
      );

      // „პროდუქციის გამოტანა“: debt −Σ price × qty, stock back up, cash untouched, receipt linked.
      const ret = await createCustomerReturn(tx, actor, {
        customerId: customer.id,
        lines: [
          { productId: p1.id, unitPrice: dec("9.5"), quantity: 2 },
          { productId: p2.id, unitPrice: dec(20), quantity: 0 },
        ],
        comment: "დაზიანებული",
      });
      const retRow = await delivery(ret.id);
      expect([retRow.kind, dec(retRow.totalAmount).toString(), dec(retRow.paidAmount).toString()]).toEqual(["return", "-19", "0"]);
      expect([await stock(p1.id), await debt(customer.id), await cash()]).toEqual([40, "221", cashBefore]);
      const [receipt] = await tx.select().from(s.stockReceipts).where(eq(s.stockReceipts.deliveryId, ret.id));
      expect([receipt.customerId, receipt.supplierId]).toEqual([customer.id, returns.id]);
      expect(receipt.comment).toBe("მაღაზიიდან გამოტანა — Shop. დაზიანებული");
      // The receipt goes only together with its operation; deleting the operation undoes both.
      await failsInSavepoint(tx, (inner) => deleteReceipt(inner, actor, receipt.id));
      await failsInSavepoint(tx, (inner) => createCustomerReturn(inner, actor, { customerId: customer.id, lines: [], comment: "" }));
      await deleteDelivery(tx, actor, ret.id, "return");
      expect([await stock(p1.id), await debt(customer.id)]).toEqual([38, "240"]);
      expect(await tx.select().from(s.stockReceipts).where(eq(s.stockReceipts.id, receipt.id))).toEqual([]);

      // Inactive: refused on new operations, orders and receipts; returns may still bring it back.
      await setProductActive(tx, actor, p2.id, false);
      const line = { productId: p2.id, price: "20", quantity: 1, giftQty: 0, leftoverQty: 0 };
      const doc = { customerId: customer.id, lines: [line], discountFactor: "1", paidAmount: dec(0), paymentMethod: "cash" as const, hasWaybill: false, comment: "" };
      await failsInSavepoint(tx, (inner) => createDelivery(inner, actor, doc));
      await failsInSavepoint(tx, (inner) => createOrder(inner, actor, { ...doc, uploadStatus: "pending" }));
      await failsInSavepoint(tx, (inner) =>
        createReceipt(inner, actor, { supplierId: null, lines: [{ productId: p2.id, quantity: 1, unitCost: dec(1) }], comment: "" }),
      );
      await createCustomerReturn(tx, actor, { customerId: customer.id, lines: [{ productId: p2.id, unitPrice: dec(20), quantity: 1 }], comment: "" });
      expect(await stock(p2.id)).toBe(45);
      expect(store.id).toBeGreaterThan(0);
    });
  });
});
