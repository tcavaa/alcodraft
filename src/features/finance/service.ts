import "server-only";

import { and, count, eq, sql } from "drizzle-orm";

import { todayIso } from "@/lib/dates";
import { type Decimal, dec, formatAmount, toDb } from "@/lib/money";
import { ActionError } from "@/server/action";
import { audit } from "@/server/audit";
import type { Tx } from "@/server/db";
import { defaultAccountId } from "@/server/db/helpers";
import { employees, financeAccounts, financeEntries, suppliers, wageAccruals } from "@/server/db/schema";

import type { Actor } from "../sales/service";

async function requireAccount(tx: Tx, actor: Actor, accountId: number) {
  const [row] = await tx
    .select()
    .from(financeAccounts)
    .where(and(eq(financeAccounts.id, accountId), eq(financeAccounts.storeId, actor.storeId)));
  if (!row) throw new ActionError("სალარო ვერ მოიძებნა.");
  return row;
}

// ── Cash book entries (old finance/add) ─────────────────────────────────────

/** balance after = previous − expense + income (computed on read, never stored). */
export async function createEntry(
  tx: Tx,
  actor: Actor,
  input: { accountId: number; amountOut: Decimal; amountIn: Decimal; description: string; note: string },
) {
  if (input.amountOut.isZero() && input.amountIn.isZero()) throw new ActionError("შეიყვანეთ ხარჯი ან შემოსავალი.");
  const account = await requireAccount(tx, actor, input.accountId);
  const [row] = await tx
    .insert(financeEntries)
    .values({
      storeId: actor.storeId,
      accountId: account.id,
      entryDate: todayIso(),
      kind: "manual",
      amountIn: toDb(input.amountIn),
      amountOut: toDb(input.amountOut),
      description: input.description,
      note: input.note,
      createdById: actor.userId,
    })
    .returning({ id: financeEntries.id });
  await audit(tx, {
    storeId: actor.storeId,
    userId: actor.userId,
    action: "finance.create",
    entityType: "finance_entry",
    entityId: row.id,
    summary: `${account.name}: ${input.amountIn.isZero() ? "" : `+${formatAmount(input.amountIn)} `}${input.amountOut.isZero() ? "" : `−${formatAmount(input.amountOut)} `}₾ — ${input.description}`,
  });
  return row;
}

export async function updateEntryText(
  tx: Tx,
  actor: Actor,
  entryId: number,
  input: { description: string; note: string },
) {
  const [entry] = await tx
    .select()
    .from(financeEntries)
    .where(and(eq(financeEntries.id, entryId), eq(financeEntries.storeId, actor.storeId)))
    .for("update");
  if (!entry) throw new ActionError("ჩანაწერი ვერ მოიძებნა.");
  await tx.update(financeEntries).set(input).where(eq(financeEntries.id, entryId));
}

/**
 * Deletes an entry. Customer payments belong to their operation (edit the
 * operation instead); deleting a wage payment gives the amount back to the
 * employee's unpaid balance.
 */
export async function deleteEntry(tx: Tx, actor: Actor, entryId: number) {
  const [entry] = await tx
    .select()
    .from(financeEntries)
    .where(and(eq(financeEntries.id, entryId), eq(financeEntries.storeId, actor.storeId)))
    .for("update");
  if (!entry) throw new ActionError("ჩანაწერი ვერ მოიძებნა.");
  if (entry.deliveryId) throw new ActionError("ეს ჩანაწერი ოპერაციას ეკუთვნის — შეცვალეთ ან წაშალეთ ოპერაცია.");
  if (entry.kind === "wage_payment" && entry.employeeId) {
    await tx
      .update(employees)
      .set({ wageBalance: sql`${employees.wageBalance} + ${toDb(dec(entry.amountOut).minus(entry.amountIn))}` })
      .where(eq(employees.id, entry.employeeId));
  }
  await tx.delete(financeEntries).where(eq(financeEntries.id, entryId));
  await audit(tx, {
    storeId: actor.storeId,
    userId: actor.userId,
    action: "finance.delete",
    entityType: "finance_entry",
    entityId: entryId,
    summary: `წაიშალა სალაროს ჩანაწერი: ${entry.description} (+${formatAmount(entry.amountIn)} / −${formatAmount(entry.amountOut)} ₾)`,
    details: entry,
  });
}

// ── Cash books (accounts) ───────────────────────────────────────────────────

export async function createAccount(tx: Tx, actor: Actor, name: string) {
  const [{ n }] = await tx
    .select({ n: count() })
    .from(financeAccounts)
    .where(eq(financeAccounts.storeId, actor.storeId));
  const [row] = await tx
    .insert(financeAccounts)
    .values({ storeId: actor.storeId, name, isDefault: n === 0, sortOrder: n })
    .returning({ id: financeAccounts.id });
  await audit(tx, {
    storeId: actor.storeId,
    userId: actor.userId,
    action: "finance.account_create",
    entityType: "finance_account",
    entityId: row.id,
    summary: `ახალი სალარო: ${name}`,
  });
  return row;
}

export async function renameAccount(tx: Tx, actor: Actor, accountId: number, name: string) {
  await requireAccount(tx, actor, accountId);
  await tx.update(financeAccounts).set({ name }).where(eq(financeAccounts.id, accountId));
}

// ── Supplier payments (old drinks/historylistmomw) ──────────────────────────

export async function paySupplier(
  tx: Tx,
  actor: Actor,
  input: { supplierId: number; amount: Decimal; note: string },
) {
  if (input.amount.isZero()) throw new ActionError("შეიყვანეთ თანხა.");
  const [supplier] = await tx
    .select()
    .from(suppliers)
    .where(and(eq(suppliers.id, input.supplierId), eq(suppliers.storeId, actor.storeId)));
  if (!supplier) throw new ActionError("მომწოდებელი ვერ მოიძებნა.");
  const [row] = await tx
    .insert(financeEntries)
    .values({
      storeId: actor.storeId,
      accountId: await defaultAccountId(tx, actor.storeId),
      entryDate: todayIso(),
      kind: "supplier_payment",
      amountOut: toDb(input.amount),
      // Old format: the cash-book line is the supplier's name, the note goes to comment2.
      description: supplier.name,
      note: input.note,
      supplierId: supplier.id,
      createdById: actor.userId,
    })
    .returning({ id: financeEntries.id });
  await audit(tx, {
    storeId: actor.storeId,
    userId: actor.userId,
    action: "supplier.pay",
    entityType: "supplier",
    entityId: supplier.id,
    summary: `გადახდა მომწოდებელს ${supplier.name}: ${formatAmount(input.amount)} ₾`,
  });
  return row;
}

// ── Employees and wages (old employees/historywages) ────────────────────────

async function lockEmployee(tx: Tx, actor: Actor, employeeId: number) {
  const [row] = await tx
    .select()
    .from(employees)
    .where(and(eq(employees.id, employeeId), eq(employees.storeId, actor.storeId)))
    .for("update");
  if (!row) throw new ActionError("თანამშრომელი ვერ მოიძებნა.");
  return row;
}

export async function createEmployee(tx: Tx, actor: Actor, input: { name: string; wageBalance: Decimal }) {
  const [row] = await tx
    .insert(employees)
    .values({ storeId: actor.storeId, name: input.name, wageBalance: toDb(input.wageBalance) })
    .returning({ id: employees.id });
  await audit(tx, {
    storeId: actor.storeId,
    userId: actor.userId,
    action: "employee.create",
    entityType: "employee",
    entityId: row.id,
    summary: `ახალი თანამშრომელი: ${input.name}`,
  });
  return row;
}

/** Old employees/edit also allowed overwriting the unpaid balance directly. */
export async function updateEmployee(
  tx: Tx,
  actor: Actor,
  employeeId: number,
  input: { name: string; wageBalance: Decimal },
) {
  const employee = await lockEmployee(tx, actor, employeeId);
  await tx
    .update(employees)
    .set({ name: input.name, wageBalance: toDb(input.wageBalance) })
    .where(eq(employees.id, employeeId));
  await audit(tx, {
    storeId: actor.storeId,
    userId: actor.userId,
    action: "employee.update",
    entityType: "employee",
    entityId: employeeId,
    summary: dec(employee.wageBalance).equals(input.wageBalance)
      ? `${input.name}: მონაცემები განახლდა`
      : `${input.name}: ხელფასის ნაშთი ${formatAmount(employee.wageBalance)} → ${formatAmount(input.wageBalance)} ₾`,
  });
}

export async function setEmployeeArchived(tx: Tx, actor: Actor, employeeId: number, archived: boolean) {
  const employee = await lockEmployee(tx, actor, employeeId);
  await tx.update(employees).set({ isArchived: archived }).where(eq(employees.id, employeeId));
  await audit(tx, {
    storeId: actor.storeId,
    userId: actor.userId,
    action: archived ? "employee.archive" : "employee.restore",
    entityType: "employee",
    entityId: employeeId,
    summary: `${employee.name} ${archived ? "გადავიდა სანაგვეში" : "აღდგა"}`,
  });
}

/** Wage earned: added to the unpaid balance (old "wage_form"). */
export async function accrueWage(
  tx: Tx,
  actor: Actor,
  input: { employeeId: number; amount: Decimal; comment: string },
) {
  if (input.amount.isZero()) throw new ActionError("შეიყვანეთ თანხა.");
  const employee = await lockEmployee(tx, actor, input.employeeId);
  await tx.insert(wageAccruals).values({
    employeeId: employee.id,
    accrualDate: todayIso(),
    amount: toDb(input.amount),
    comment: input.comment,
    createdById: actor.userId,
  });
  await tx
    .update(employees)
    .set({ wageBalance: toDb(dec(employee.wageBalance).plus(input.amount)) })
    .where(eq(employees.id, employee.id));
  await audit(tx, {
    storeId: actor.storeId,
    userId: actor.userId,
    action: "employee.accrue",
    entityType: "employee",
    entityId: employee.id,
    summary: `${employee.name}: დაერიცხა ${formatAmount(input.amount)} ₾`,
  });
}

/** Wage paid: cash-book expense + lower unpaid balance (old "gadaxdili_form"). */
export async function payWage(tx: Tx, actor: Actor, input: { employeeId: number; amount: Decimal; note: string }) {
  if (input.amount.isZero()) throw new ActionError("შეიყვანეთ თანხა.");
  const employee = await lockEmployee(tx, actor, input.employeeId);
  await tx.insert(financeEntries).values({
    storeId: actor.storeId,
    accountId: await defaultAccountId(tx, actor.storeId),
    entryDate: todayIso(),
    kind: "wage_payment",
    amountOut: toDb(input.amount),
    description: employee.name,
    note: input.note,
    employeeId: employee.id,
    createdById: actor.userId,
  });
  await tx
    .update(employees)
    .set({ wageBalance: toDb(dec(employee.wageBalance).minus(input.amount)) })
    .where(eq(employees.id, employee.id));
  await audit(tx, {
    storeId: actor.storeId,
    userId: actor.userId,
    action: "employee.pay",
    entityType: "employee",
    entityId: employee.id,
    summary: `${employee.name}: გაეცა ${formatAmount(input.amount)} ₾`,
  });
}
