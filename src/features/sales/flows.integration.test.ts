/**
 * End-to-end business flows against the real database, inside ONE transaction that is
 * always rolled back (nothing is left behind). Skipped when DATABASE_URL_SESSION is not set.
 */
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { afterAll, describe, expect, it } from "vitest";

import { dec } from "@/lib/money";
import { ActionError } from "@/server/action";
import { customerDebt } from "@/server/db/helpers";
import { createPool } from "@/server/db/pool";
import * as s from "@/server/db/schema";

import { createStore } from "../admin/service";
import { createCustomer, createProduct, createSupplier } from "../catalog/service";
import { accrueWage, createEmployee, paySupplier, payWage } from "../finance/service";
import { createReceipt } from "../stock/service";
import {
  completeOrder,
  createDebtAdjustment,
  createDelivery,
  createOrder,
  deleteDelivery,
  updateDelivery,
} from "./service";

const url = process.env.DATABASE_URL_SESSION;
const enabled = Boolean(url && !url.includes("[YOUR-PASSWORD]"));

class Rollback extends Error {}

describe.skipIf(!enabled)("money & stock flows (rolled back)", () => {
  const pool = enabled ? createPool(url, { max: 1 }) : null;
  const db = pool ? drizzle({ client: pool, schema: s, casing: "snake_case" }) : null;
  afterAll(async () => {
    await pool?.end();
  });

  it("keeps stock, customer debt and the cash book consistent", async () => {
    const run = db!.transaction(async (tx) => {
      const [user] = await tx
        .insert(s.users)
        .values({ email: `flow-test-${Date.now()}@example.invalid`, passwordHash: "x", role: "super_admin" })
        .returning({ id: s.users.id });
      const store = await createStore(tx, user.id, { name: "TEST STORE" });
      const actor = { userId: user.id, storeId: store.id };

      const stock = async (productId: number) =>
        (await tx.select({ q: s.products.stockQty }).from(s.products).where(eq(s.products.id, productId)))[0].q;
      const cash = async () =>
        dec(
          (
            await tx
              .select({ b: sql<string>`coalesce(sum(${s.financeEntries.amountIn} - ${s.financeEntries.amountOut} + ${s.financeEntries.adjustmentAmount}), 0)` })
              .from(s.financeEntries)
              .where(eq(s.financeEntries.storeId, store.id))
          )[0].b,
        ).toString();

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
      expect(d1.total.toString()).toBe("77.35"); // 3×14.45 + 2×17
      expect(await stock(p1.id)).toBe(6); // −3 −1 gift
      expect(await stock(p2.id)).toBe(3);
      expect((await customerDebt(tx, customer.id)).toString()).toBe("47.35");
      expect(await cash()).toBe("30");

      // Delivered quantity may not exceed stock (old form max=count).
      await expect(
        tx.transaction((inner) =>
          createDelivery(inner, actor, {
            customerId: customer.id,
            lines: [{ productId: p1.id, price: "17", quantity: 7, giftQty: 0, leftoverQty: 0 }],
            discountFactor: "1",
            paidAmount: dec(0),
            paymentMethod: "cash",
            hasWaybill: true,
            comment: "",
          }),
        ),
      ).rejects.toBeInstanceOf(ActionError);

      // Payment only (card) and a "back" payment (debt drops, cash doesn't).
      await createDelivery(tx, actor, { customerId: customer.id, lines: [], discountFactor: "1", paidAmount: dec(20), paymentMethod: "card", hasWaybill: false, comment: "" });
      await createDelivery(tx, actor, { customerId: customer.id, lines: [], discountFactor: "1", paidAmount: dec(5), paymentMethod: "back", hasWaybill: false, comment: "" });
      expect((await customerDebt(tx, customer.id)).toString()).toBe("22.35");
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
      expect((await customerDebt(tx, customer.id)).toString()).toBe("-2.1"); // 62.9 − 40 − 20 − 5
      expect(await cash()).toBe("60");

      // Manual correction brings the debt to zero.
      await createDebtAdjustment(tx, actor, { customerId: customer.id, amount: dec("2.1"), comment: "test" });
      expect((await customerDebt(tx, customer.id)).toString()).toBe("0");

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
      expect((await customerDebt(tx, customer.id)).toString()).toBe("200");
      await deleteDelivery(tx, actor, fromOrder.id);
      expect(await stock(p2.id)).toBe(3);
      expect((await customerDebt(tx, customer.id)).toString()).toBe("0");
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

      throw new Rollback();
    });
    await expect(run).rejects.toBeInstanceOf(Rollback);
  });
});
