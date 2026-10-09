/**
 * Builds every row of the new schema from the old MySQL tables, in memory.
 * Nothing is written here — see import.ts. Every rule mirrors what the old PHP
 * code did, so imported numbers are exactly the numbers people saw.
 */
import { createHash } from "node:crypto";

import bcrypt from "bcryptjs";

import { Decimal, toDb } from "../../src/lib/money";
import type * as s from "../../src/server/db/schema";
import {
  DEFAULT_PLACEHOLDER_COMMENTS,
  DROPPED_FINANCE_ROWS,
  type LegacyStoreSet,
  RETURNS_SUPPLIER_PATTERN,
  STORE_SETS,
  SUPER_ADMIN_EMAILS,
  USER_STORE_ACCESS,
} from "./config";
import { cleanText, isDirtyNumber, legacyDate, money4, phpInt, phpNumber } from "./php";
import { type Legacy, type LegacyRow, NON_ZERO_ITEM_FILTER } from "./source";

type Row<T> = T extends { $inferInsert: infer I } ? I : never;

export interface ImportData {
  stores: Row<typeof s.stores>[];
  financeAccounts: Row<typeof s.financeAccounts>[];
  suppliers: Row<typeof s.suppliers>[];
  products: Row<typeof s.products>[];
  productPriceChanges: Row<typeof s.productPriceChanges>[];
  customers: Row<typeof s.customers>[];
  employees: Row<typeof s.employees>[];
  wageAccruals: Row<typeof s.wageAccruals>[];
  deliveries: Row<typeof s.deliveries>[];
  deliveryItems: Row<typeof s.deliveryItems>[];
  orders: Row<typeof s.orders>[];
  orderItems: Row<typeof s.orderItems>[];
  stockReceipts: Row<typeof s.stockReceipts>[];
  stockReceiptItems: Row<typeof s.stockReceiptItems>[];
  financeEntries: Row<typeof s.financeEntries>[];
  users: Row<typeof s.users>[];
  userStores: Row<typeof s.userStores>[];
}

/** Everything the report needs to explain what was cleaned or reconstructed. */
export interface ImportNotes {
  placeholderProducts: { store: string; legacyId: number }[];
  placeholderCustomers: { store: string; legacyId: number }[];
  orphanDeliveryItems: { store: string; rows: number; deliveries: number; quantity: number; total: string }[];
  orphanOrderItems: { store: string; rows: number }[];
  droppedZeroItemRows: { store: string; table: string; rows: number }[];
  skippedEmptyReceipts: { store: string; count: number }[];
  emptyReceiptComments: { store: string; date: string; comment: string }[];
  droppedZeroFinanceRows: { table: string; count: number }[];
  removedFinanceRows: { table: string; ids: number[] }[];
  deliveryAdjustments: { store: string; count: number; total: string }[];
  financeAdjustments: { table: string; count: number; total: string }[];
  financeLinks: { table: string; delivery: number; supplier: number; employee: number }[];
  dirtyValues: { table: string; column: string; id: string; raw: string; usedAs: string }[];
  nonIntegerQuantities: { table: string; raw: string }[];
  unknownOrderStatuses: { store: string; status: string; count: number }[];
  ambiguousNames: string[];
}

class Seq {
  private value = 0;
  next() {
    return ++this.value;
  }
}

const PAYMENT_METHODS = new Set(["cash", "card", "back"]);
const COLORS = new Set(["green", "yellow", "red"]);
const ORDER_STATUS: Record<string, "open" | "completed" | "cancelled"> = {
  "0": "open",
  "1": "completed",
  "3": "cancelled",
};

const normName = (v: string | null | undefined) =>
  cleanText(v).replace(/\s+/g, " ").toLowerCase();

const placeholderComment = (v: string | null | undefined) => {
  const text = cleanText(v);
  return DEFAULT_PLACEHOLDER_COMMENTS.has(text) ? "" : text;
};

function waybill(raw: string | null): boolean | null {
  if (raw === "yes") return true;
  if (raw === "no") return false;
  return null;
}

function upload(raw: string | null): "pending" | "uploaded" | null {
  const v = cleanText(raw);
  if (v === "ასატვირთი") return "pending";
  if (v === "ატვირთული") return "uploaded";
  return null;
}

function payment(raw: string | null): "cash" | "card" | "back" | null {
  const v = cleanText(raw);
  return PAYMENT_METHODS.has(v) ? (v as "cash" | "card" | "back") : null;
}

function discount(raw: string | null): string | null {
  const v = cleanText(raw);
  if (v === "") return null;
  return phpNumber(v).toDecimalPlaces(4).toFixed(4);
}

export async function buildImport(legacy: Legacy): Promise<{ data: ImportData; notes: ImportNotes }> {
  const data: ImportData = {
    stores: [],
    financeAccounts: [],
    suppliers: [],
    products: [],
    productPriceChanges: [],
    customers: [],
    employees: [],
    wageAccruals: [],
    deliveries: [],
    deliveryItems: [],
    orders: [],
    orderItems: [],
    stockReceipts: [],
    stockReceiptItems: [],
    financeEntries: [],
    users: [],
    userStores: [],
  };
  const notes: ImportNotes = {
    placeholderProducts: [],
    placeholderCustomers: [],
    orphanDeliveryItems: [],
    orphanOrderItems: [],
    droppedZeroItemRows: [],
    skippedEmptyReceipts: [],
    emptyReceiptComments: [],
    droppedZeroFinanceRows: [],
    removedFinanceRows: [],
    deliveryAdjustments: [],
    financeAdjustments: [],
    financeLinks: [],
    dirtyValues: [],
    nonIntegerQuantities: [],
    unknownOrderStatuses: [],
    ambiguousNames: [],
  };

  const seq = {
    store: new Seq(),
    account: new Seq(),
    supplier: new Seq(),
    product: new Seq(),
    priceChange: new Seq(),
    customer: new Seq(),
    employee: new Seq(),
    accrual: new Seq(),
    delivery: new Seq(),
    deliveryItem: new Seq(),
    order: new Seq(),
    orderItem: new Seq(),
    receipt: new Seq(),
    receiptItem: new Seq(),
    finance: new Seq(),
    user: new Seq(),
  };

  const names = new Map((await legacy.rows("SELECT id, name FROM names")).map((r) => [Number(r.id), r.name ?? ""]));
  const storeIdByKey = new Map<string, number>();

  const noteDirty = (table: string, column: string, id: string | null, raw: string | null, used: Decimal) => {
    if (isDirtyNumber(raw)) notes.dirtyValues.push({ table, column, id: id ?? "?", raw: raw ?? "", usedAs: used.toString() });
  };
  const legacyRaw = (row: LegacyRow, columns: string[]) => {
    const raw: Record<string, string> = {};
    for (const c of columns) if (isDirtyNumber(row[c])) raw[c] = row[c] ?? "";
    return Object.keys(raw).length ? raw : null;
  };
  const qty = (table: string, raw: string | null) => {
    const n = phpNumber(raw);
    if (!n.isInteger()) notes.nonIntegerQuantities.push({ table, raw: raw ?? "" });
    return n.truncated().toNumber();
  };
  const requireDate = (table: string, id: string | null, raw: string | null) => {
    const d = legacyDate(raw);
    if (!d) throw new Error(`Invalid date "${raw}" in ${table} id=${id}`);
    return d;
  };

  for (const [index, set] of STORE_SETS.entries()) {
    await importStoreSet(set, index);
  }
  await importUsers();

  return { data, notes };

  // ────────────────────────────────────────────────────────────────────────

  async function importStoreSet(set: LegacyStoreSet, index: number) {
    const sx = set.suffix;
    const storeId = seq.store.next();
    storeIdByKey.set(set.key, storeId);
    const storeName = cleanText(names.get(set.nameId)) || `Store ${index + 1}`;

    // Next document numbers continue where the old AUTO_INCREMENT stopped.
    const nextDelivery = await legacy.autoIncrement(`distribution${sx}`);
    const nextOrder = await legacy.autoIncrement(`orders${sx}`);
    data.stores.push({
      id: storeId,
      name: storeName,
      sortOrder: index + 1,
      legacyKey: set.key,
      nextDeliveryNumber: nextDelivery,
      nextOrderNumber: nextOrder,
      nextReceiptNumber: 1, // set after receipts are numbered
    });

    // ── finance books ──
    const accountIdByTable = new Map<string, number>();
    for (const [i, book] of set.finance.entries()) {
      if (!(await legacy.tableExists(book.table))) continue;
      const id = seq.account.next();
      accountIdByTable.set(book.table, id);
      data.financeAccounts.push({
        id,
        storeId,
        name: book.name,
        isDefault: book.isDefault,
        sortOrder: i,
        legacyTable: book.table,
      });
    }

    // ── suppliers ──
    const supplierByLegacy = new Map<number, number>();
    const supplierByName = new Map<string, number>();
    for (const r of await legacy.rows(`SELECT * FROM momwodebeli${sx} ORDER BY id`)) {
      const id = seq.supplier.next();
      const legacyId = Number(r.id);
      const name = cleanText(r.name);
      supplierByLegacy.set(legacyId, id);
      const key = normName(name);
      if (supplierByName.has(key)) notes.ambiguousNames.push(`${set.key}: supplier "${name}"`);
      else supplierByName.set(key, id);
      data.suppliers.push({
        id,
        storeId,
        name,
        isReturns: RETURNS_SUPPLIER_PATTERN.test(name),
        isArchived: r.status === "1",
        legacyId,
      });
    }

    // ── products ──
    const productByLegacy = new Map<number, number>();
    for (const r of await legacy.rows(`SELECT * FROM drinks${sx} ORDER BY id`)) {
      const id = seq.product.next();
      const legacyId = Number(r.id);
      productByLegacy.set(legacyId, id);
      const salePrice = money4(r.base_price);
      const purchasePrice = money4(r.shemotan_price);
      noteDirty(`drinks${sx}`, "base_price", r.id, r.base_price, salePrice);
      noteDirty(`drinks${sx}`, "shemotan_price", r.id, r.shemotan_price, purchasePrice);
      data.products.push({
        id,
        storeId,
        supplierId: supplierByLegacy.get(phpInt(r.momw_cat)) ?? null,
        name: cleanText(r.name),
        salePrice: toDb(salePrice),
        purchasePrice: toDb(purchasePrice),
        stockQty: qty(`drinks${sx}.count`, r.count),
        comment: cleanText(r.comment),
        isArchived: r.status === "1",
        legacyId,
      });
    }
    /** Old rows can point at hard-deleted products; keep history with an archived placeholder. */
    const productRef = (rawId: string | null) => {
      const legacyId = phpInt(rawId);
      const existing = productByLegacy.get(legacyId);
      if (existing) return existing;
      const id = seq.product.next();
      productByLegacy.set(legacyId, id);
      notes.placeholderProducts.push({ store: set.key, legacyId });
      data.products.push({
        id,
        storeId,
        name: `[წაშლილი პროდუქტი #${legacyId}]`,
        isArchived: true,
        legacyId,
      });
      return id;
    };

    // ── price history ──
    for (const r of await legacy.rows(`SELECT * FROM drinks${sx}_edited ORDER BY id`)) {
      data.productPriceChanges.push({
        id: seq.priceChange.next(),
        productId: productRef(r.drink_id),
        oldSalePrice: toDb(money4(r.base_price)),
        oldPurchasePrice: toDb(money4(r.shemotan_price)),
        changedOn: requireDate(`drinks${sx}_edited`, r.id, r.date),
      });
    }

    // ── customers ──
    const customerByLegacy = new Map<number, number>();
    const customerName = new Map<number, string>();
    for (const r of await legacy.rows(`SELECT * FROM company${sx} ORDER BY id`)) {
      const id = seq.customer.next();
      const legacyId = Number(r.id);
      customerByLegacy.set(legacyId, id);
      customerName.set(id, r.name ?? "");
      const color = cleanText(r.color);
      data.customers.push({
        id,
        storeId,
        name: cleanText(r.name),
        address: cleanText(r.address),
        taxId: cleanText(r.ident),
        phone: cleanText(r.number),
        contactPerson: cleanText(r.contact),
        comment: cleanText(r.comment),
        color: COLORS.has(color) ? (color as "green" | "yellow" | "red") : null,
        isArchived: r.status === "1",
        legacyId,
      });
    }
    const customerRef = (rawId: string | null) => {
      const legacyId = phpInt(rawId);
      const existing = customerByLegacy.get(legacyId);
      if (existing) return existing;
      const id = seq.customer.next();
      customerByLegacy.set(legacyId, id);
      customerName.set(id, "");
      notes.placeholderCustomers.push({ store: set.key, legacyId });
      data.customers.push({
        id,
        storeId,
        name: `[წაშლილი ობიექტი #${legacyId}]`,
        isArchived: true,
        legacyId,
      });
      return id;
    };

    // ── deliveries (old `distribution`) ──
    const deliveryByLegacy = new Map<number, number>();
    /** For linking cash-book entries: "date|amount|customer method" → delivery ids, oldest first. */
    const deliveryPaymentKeys = new Map<string, number[]>();
    const lastDebt = new Map<number, Decimal>();
    let adjustmentCount = 0;
    let adjustmentTotal = new Decimal(0);
    for (const r of await legacy.rows(`SELECT * FROM distribution${sx} ORDER BY id`)) {
      const id = seq.delivery.next();
      const number = Number(r.id);
      deliveryByLegacy.set(number, id);
      const customerId = customerRef(r.company_id);
      const total = money4(r.fullamount);
      const paid = money4(r.money);
      const storedDebt = money4(r.darchenili);
      noteDirty(`distribution${sx}`, "money", r.id, r.money, paid);
      noteDirty(`distribution${sx}`, "fullamount", r.id, r.fullamount, total);
      noteDirty(`distribution${sx}`, "darchenili", r.id, r.darchenili, storedDebt);
      // Old rule: darchenili = fullamount + previous darchenili − money.
      // Anything else (manual DB edits) becomes an explicit adjustment.
      const expected = (lastDebt.get(customerId) ?? new Decimal(0)).plus(total).minus(paid);
      const adjustment = storedDebt.minus(expected);
      lastDebt.set(customerId, storedDebt);
      if (!adjustment.isZero()) {
        adjustmentCount++;
        adjustmentTotal = adjustmentTotal.plus(adjustment);
      }
      const date = requireDate(`distribution${sx}`, r.id, r.date);
      const method = payment(r.pay_meth);
      data.deliveries.push({
        id,
        storeId,
        customerId,
        number,
        kind: "delivery",
        deliveryDate: date,
        totalAmount: toDb(total),
        paidAmount: toDb(paid),
        adjustmentAmount: toDb(adjustment),
        paymentMethod: method,
        hasWaybill: waybill(r.zedna),
        discountFactor: discount(r.sale),
        uploadStatus: upload(r.upld),
        comment: cleanText(r.comment),
        legacy: legacyRaw(r, ["money", "fullamount", "darchenili"]),
      });
      if ((method === "cash" || method === "card") && !paid.isZero()) {
        const key = `${date}|${toDb(paid)}|${normName(`${customerName.get(customerId) ?? ""} ${method}`)}`;
        const queue = deliveryPaymentKeys.get(key) ?? [];
        queue.push(id);
        deliveryPaymentKeys.set(key, queue);
      }
    }
    notes.deliveryAdjustments.push({ store: set.key, count: adjustmentCount, total: adjustmentTotal.toString() });

    // ── delivery items (old `drinks_count`, zero rows dropped) ──
    {
      const table = `drinks${sx}_count`;
      const totalRows = Number((await legacy.rows(`SELECT COUNT(*) AS n FROM ${table}`))[0].n);
      const rows = await legacy.rows(
        `SELECT distribution_id, drink_id, drink_price, drink_in, drink_sum, drink_gift, drink_out FROM ${table} WHERE ${NON_ZERO_ITEM_FILTER}`,
      );
      let kept = 0;
      const orphan = { rows: 0, deliveries: new Set<string>(), quantity: 0, total: new Decimal(0) };
      for (const r of rows) {
        const quantity = qty(table, r.drink_in);
        const giftQty = qty(table, r.drink_gift);
        const leftoverQty = qty(table, r.drink_out);
        const lineTotal = money4(r.drink_sum);
        if (quantity === 0 && giftQty === 0 && leftoverQty === 0 && lineTotal.isZero()) continue;
        const deliveryId = deliveryByLegacy.get(phpInt(r.distribution_id));
        if (!deliveryId) {
          orphan.rows++;
          orphan.deliveries.add(r.distribution_id ?? "?");
          orphan.quantity += quantity;
          orphan.total = orphan.total.plus(lineTotal);
          continue;
        }
        kept++;
        data.deliveryItems.push({
          id: seq.deliveryItem.next(),
          deliveryId,
          productId: productRef(r.drink_id),
          unitPrice: toDb(money4(r.drink_price)),
          quantity,
          giftQty,
          leftoverQty,
          lineTotal: toDb(lineTotal),
        });
      }
      notes.droppedZeroItemRows.push({ store: set.key, table, rows: totalRows - kept - orphan.rows });
      if (orphan.rows) {
        notes.orphanDeliveryItems.push({
          store: set.key,
          rows: orphan.rows,
          deliveries: orphan.deliveries.size,
          quantity: orphan.quantity,
          total: orphan.total.toString(),
        });
      }
    }

    // ── orders ──
    const orderByLegacy = new Map<number, number>();
    const unknownStatuses = new Map<string, number>();
    for (const r of await legacy.rows(`SELECT * FROM orders${sx} ORDER BY id`)) {
      const id = seq.order.next();
      const number = Number(r.id);
      orderByLegacy.set(number, id);
      const status = ORDER_STATUS[cleanText(r.status)];
      if (!status) unknownStatuses.set(r.status ?? "", (unknownStatuses.get(r.status ?? "") ?? 0) + 1);
      data.orders.push({
        id,
        storeId,
        customerId: customerRef(r.company_id),
        number,
        orderDate: requireDate(`orders${sx}`, r.id, r.date),
        status: status ?? "cancelled",
        totalAmount: toDb(money4(r.fullamount)),
        paidAmount: toDb(money4(r.money)),
        debtSnapshot: toDb(money4(r.darchenili)),
        paymentMethod: payment(r.pay_meth),
        hasWaybill: waybill(r.zedna),
        discountFactor: discount(r.sale),
        uploadStatus: upload(r.upld),
        comment: cleanText(r.comment),
        legacy: legacyRaw(r, ["money", "fullamount", "darchenili"]),
      });
    }
    for (const [status, count] of unknownStatuses) notes.unknownOrderStatuses.push({ store: set.key, status, count });

    {
      const table = `drinks${sx}_count_orders`;
      const totalRows = Number((await legacy.rows(`SELECT COUNT(*) AS n FROM ${table}`))[0].n);
      const rows = await legacy.rows(
        `SELECT orders_id, drink_id, drink_price, drink_in, drink_sum, drink_gift, drink_out FROM ${table} WHERE ${NON_ZERO_ITEM_FILTER}`,
      );
      let kept = 0;
      let orphans = 0;
      for (const r of rows) {
        const quantity = qty(table, r.drink_in);
        const giftQty = qty(table, r.drink_gift);
        const leftoverQty = qty(table, r.drink_out);
        const lineTotal = money4(r.drink_sum);
        if (quantity === 0 && giftQty === 0 && leftoverQty === 0 && lineTotal.isZero()) continue;
        const orderId = orderByLegacy.get(phpInt(r.orders_id));
        if (!orderId) {
          orphans++;
          continue;
        }
        kept++;
        data.orderItems.push({
          id: seq.orderItem.next(),
          orderId,
          productId: productRef(r.drink_id),
          unitPrice: toDb(money4(r.drink_price)),
          quantity,
          giftQty,
          leftoverQty,
          lineTotal: toDb(lineTotal),
        });
      }
      notes.droppedZeroItemRows.push({ store: set.key, table, rows: totalRows - kept - orphans });
      if (orphans) notes.orphanOrderItems.push({ store: set.key, rows: orphans });
    }

    // ── stock receipts (old `drinks_history`: rows sharing an id form one receipt) ──
    {
      const table = `drinks${sx}_history`;
      // Physical (insertion) order: ids overflowed INT once, so they are not a reliable timeline.
      const rows = await legacy.rows(`SELECT * FROM ${table}`);
      const groups = new Map<string, LegacyRow[]>();
      for (const r of rows) {
        const key = `${r.id}|${r.date}|${r.momwodebeli_id}|${r.comment ?? ""}`;
        const g = groups.get(key);
        if (g) g.push(r);
        else groups.set(key, [r]);
      }
      let number = 0;
      let skipped = 0;
      for (const group of groups.values()) {
        const first = group[0];
        const items = group.filter((r) => phpInt(r.drink_in) !== 0);
        const comment = cleanText(first.comment);
        if (items.length === 0) {
          // Saved without quantities: no stock effect. Listed in the report instead.
          skipped++;
          if (comment !== "" && comment !== "0")
            notes.emptyReceiptComments.push({ store: set.key, date: first.date ?? "", comment });
          continue;
        }
        const receiptId = seq.receipt.next();
        number++;
        data.stockReceipts.push({
          id: receiptId,
          storeId,
          supplierId: supplierByLegacy.get(phpInt(first.momwodebeli_id)) ?? null,
          number,
          receiptDate: requireDate(table, first.id, first.date),
          comment,
          legacyBatchId: Number(first.id),
        });
        for (const r of items) {
          data.stockReceiptItems.push({
            id: seq.receiptItem.next(),
            receiptId,
            productId: productRef(r.drink_id),
            quantity: qty(table, r.drink_in),
            unitCost: toDb(money4(r.shemotan_price)),
            stockBefore: qty(`${table}.drink_count`, r.drink_count),
          });
        }
      }
      const store = data.stores.find((st) => st.id === storeId)!;
      store.nextReceiptNumber = number + 1;
      notes.skippedEmptyReceipts.push({ store: set.key, count: skipped });
    }

    // ── employees (first store only) ──
    const employeeByLegacy = new Map<number, number>();
    const employeeByName = new Map<string, number>();
    if (set.hasEmployees) {
      for (const r of await legacy.rows("SELECT * FROM employees ORDER BY id")) {
        const id = seq.employee.next();
        employeeByLegacy.set(Number(r.id), id);
        const key = normName(r.name);
        if (employeeByName.has(key) || supplierByName.has(key)) notes.ambiguousNames.push(`${set.key}: employee "${r.name}"`);
        if (!employeeByName.has(key)) employeeByName.set(key, id);
        data.employees.push({
          id,
          storeId,
          name: cleanText(r.name),
          wageBalance: toDb(money4(r.wage)),
          isArchived: r.status === "1",
          legacyId: Number(r.id),
        });
      }
      for (const r of await legacy.rows("SELECT * FROM wages_history ORDER BY id")) {
        const employeeId = employeeByLegacy.get(phpInt(r.employees_id));
        if (!employeeId) continue;
        data.wageAccruals.push({
          id: seq.accrual.next(),
          employeeId,
          accrualDate: requireDate("wages_history", r.id, r.date),
          amount: toDb(money4(r.wage)),
          comment: placeholderComment(r.comment),
        });
      }
    }

    // ── finance books ──
    for (const book of set.finance) {
      const accountId = accountIdByTable.get(book.table);
      if (!accountId) continue;
      let previous = new Decimal(0);
      let dropped = 0;
      let adjCount = 0;
      let adjTotal = new Decimal(0);
      const links = { delivery: 0, supplier: 0, employee: 0 };
      const removed: number[] = [];
      for (const r of await legacy.rows(`SELECT * FROM ${book.table} ORDER BY id`)) {
        if (DROPPED_FINANCE_ROWS[book.table]?.includes(Number(r.id))) {
          // `previous` is left as is, so the next row's correction absorbs the removed rows' net effect.
          removed.push(Number(r.id));
          continue;
        }
        const out = money4(r.money);
        const income = money4(r.darchenili);
        const stored = money4(r.balance);
        noteDirty(book.table, "money", r.id, r.money, out);
        noteDirty(book.table, "darchenili", r.id, r.darchenili, income);
        // Old rule: balance = previous balance − money + darchenili.
        const adjustment = stored.minus(previous.minus(out).plus(income));
        previous = stored;
        if (!adjustment.isZero()) {
          adjCount++;
          adjTotal = adjTotal.plus(adjustment);
        }
        if (out.isZero() && income.isZero() && adjustment.isZero()) {
          dropped++; // the old list hid these rows; they never changed the balance
          continue;
        }
        const date = requireDate(book.table, r.id, r.date);
        const description = cleanText(r.comment);
        let deliveryId: number | null = null;
        let supplierId: number | null = null;
        let employeeId: number | null = null;
        if (book.isDefault) {
          const name = normName(description);
          supplierId = supplierByName.get(name) ?? null;
          employeeId = supplierId ? null : (employeeByName.get(name) ?? null);
          if (!supplierId && !employeeId && income.gt(0) && out.isZero()) {
            const queue = deliveryPaymentKeys.get(`${date}|${toDb(income)}|${name}`);
            if (queue?.length) deliveryId = queue.shift()!;
          }
        }
        if (deliveryId) links.delivery++;
        if (supplierId) links.supplier++;
        if (employeeId) links.employee++;
        data.financeEntries.push({
          id: seq.finance.next(),
          storeId,
          accountId,
          entryDate: date,
          kind: deliveryId
            ? "delivery"
            : supplierId && out.gt(0)
              ? "supplier_payment"
              : employeeId && out.gt(0)
                ? "wage_payment"
                : "manual",
          amountIn: toDb(income),
          amountOut: toDb(out),
          adjustmentAmount: toDb(adjustment),
          description,
          note: placeholderComment(r.comment2),
          deliveryId,
          supplierId,
          employeeId,
          legacyId: Number(r.id),
          legacy: legacyRaw(r, ["money", "darchenili", "balance"]),
        });
      }
      notes.droppedZeroFinanceRows.push({ table: book.table, count: dropped });
      if (removed.length) notes.removedFinanceRows.push({ table: book.table, ids: removed });
      notes.financeAdjustments.push({ table: book.table, count: adjCount, total: adjTotal.toString() });
      notes.financeLinks.push({ table: book.table, ...links });
    }
  }

  async function importUsers() {
    const allStoreIds = [...storeIdByKey.values()];
    for (const r of await legacy.rows("SELECT * FROM users ORDER BY id")) {
      const email = cleanText(r.email).toLowerCase();
      if (!email) continue;
      const id = seq.user.next();
      const md5 = cleanText(r.password).toLowerCase();
      const isMd5 = /^[0-9a-f]{32}$/.test(md5);
      // bcrypt(md5(password)): the old MD5 never sits in the new DB; upgraded to bcrypt(password) on first login.
      const passwordHash = await bcrypt.hash(isMd5 ? md5 : createHash("sha256").update(String(Math.random())).digest("hex"), 12);
      const isSuper = SUPER_ADMIN_EMAILS.includes(email);
      data.users.push({
        id,
        email,
        name: email.split("@")[0],
        passwordHash,
        passwordScheme: "legacy_md5_bcrypt",
        role: isSuper ? "super_admin" : "user",
        isActive: r.status === "3" && isMd5,
      });
      if (isSuper) continue;
      const keys = USER_STORE_ACCESS[email];
      const storeIds = keys ? keys.map((k) => storeIdByKey.get(k)!).filter(Boolean) : allStoreIds;
      for (const storeId of storeIds) data.userStores.push({ userId: id, storeId });
    }
  }
}

