import "server-only";

import { and, asc, count, desc, eq, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";

import type { SortState } from "@/lib/sort";
import { db } from "@/server/db";
import { by } from "@/server/db/order";
import {
  deliveries,
  employees,
  financeAccounts,
  financeEntries,
  suppliers,
  users,
  wageAccruals,
} from "@/server/db/schema";

const likeEscape = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
const balanceExpr = sql<string>`coalesce(sum(${financeEntries.amountIn} - ${financeEntries.amountOut} + ${financeEntries.adjustmentAmount}), 0)`;

export async function listAccounts(storeId: number) {
  return db
    .select({
      id: financeAccounts.id,
      name: financeAccounts.name,
      isDefault: financeAccounts.isDefault,
      isArchived: financeAccounts.isArchived,
      balance: balanceExpr,
      entries: sql<number>`count(${financeEntries.id})::int`,
    })
    .from(financeAccounts)
    .leftJoin(financeEntries, eq(financeEntries.accountId, financeAccounts.id))
    .where(eq(financeAccounts.storeId, storeId))
    .groupBy(financeAccounts.id)
    .orderBy(desc(financeAccounts.isDefault), asc(financeAccounts.sortOrder), asc(financeAccounts.id));
}

export const ENTRY_SORTS = ["date", "out", "in", "balance", "comment"] as const;
export type EntrySort = (typeof ENTRY_SORTS)[number];

export interface EntryListParams {
  q?: string;
  from?: string;
  to?: string;
  direction?: "in" | "out";
  sort: SortState<EntrySort> | null;
  page: number;
  pageSize: number;
}

/** Old finance/index: every entry with the balance right after it (newest first). */
export async function listEntries(accountId: number, p: EntryListParams) {
  const running = db
    .select({
      id: financeEntries.id,
      date: financeEntries.entryDate,
      kind: financeEntries.kind,
      amountIn: financeEntries.amountIn,
      amountOut: financeEntries.amountOut,
      adjustment: financeEntries.adjustmentAmount,
      description: financeEntries.description,
      note: financeEntries.note,
      deliveryId: financeEntries.deliveryId,
      supplierId: financeEntries.supplierId,
      employeeId: financeEntries.employeeId,
      createdById: financeEntries.createdById,
      balanceAfter:
        sql<string>`sum(${financeEntries.amountIn} - ${financeEntries.amountOut} + ${financeEntries.adjustmentAmount}) over (order by ${financeEntries.id})`.as(
          "balance_after",
        ),
    })
    .from(financeEntries)
    .where(eq(financeEntries.accountId, accountId))
    .as("running");

  const conditions: (SQL | undefined)[] = [];
  if (p.q) {
    const like = likeEscape(p.q);
    conditions.push(or(ilike(running.description, like), ilike(running.note, like)));
  }
  if (p.from) conditions.push(gte(running.date, p.from));
  if (p.to) conditions.push(lte(running.date, p.to));
  if (p.direction === "in") conditions.push(sql`${running.amountIn} <> 0`);
  if (p.direction === "out") conditions.push(sql`${running.amountOut} <> 0`);
  const where = conditions.length ? and(...conditions) : undefined;
  const s = p.sort;
  const order = !s
    ? [desc(running.id)]
    : s.column === "date"
      ? [by(running.date, s.dir), by(running.id, s.dir)]
      : [
          by(
            {
              // rows without an expense / income count as empty, so they stay last
              out: sql`nullif(${running.amountOut}, 0)`,
              in: sql`nullif(${running.amountIn}, 0)`,
              balance: running.balanceAfter,
              comment: sql`nullif(${running.description}, '')`,
            }[s.column],
            s.dir,
          ),
          desc(running.id),
        ];

  const [rows, [totals]] = await Promise.all([
    db
      .select({
        id: running.id,
        date: running.date,
        kind: running.kind,
        amountIn: running.amountIn,
        amountOut: running.amountOut,
        adjustment: running.adjustment,
        description: running.description,
        note: running.note,
        deliveryId: running.deliveryId,
        deliveryNumber: deliveries.number,
        supplierId: running.supplierId,
        supplierName: suppliers.name,
        employeeId: running.employeeId,
        employeeName: employees.name,
        createdBy: users.name,
        balanceAfter: running.balanceAfter,
      })
      .from(running)
      .leftJoin(deliveries, eq(deliveries.id, running.deliveryId))
      .leftJoin(suppliers, eq(suppliers.id, running.supplierId))
      .leftJoin(employees, eq(employees.id, running.employeeId))
      .leftJoin(users, eq(users.id, running.createdById))
      .where(where)
      .orderBy(...order)
      .limit(p.pageSize)
      .offset((p.page - 1) * p.pageSize),
    db
      .select({
        count: count(),
        totalIn: sql<string>`coalesce(sum(${running.amountIn}), 0)`,
        totalOut: sql<string>`coalesce(sum(${running.amountOut}), 0)`,
      })
      .from(running)
      .where(where),
  ]);
  return { rows, ...totals };
}

/** Old finance/month: expense, income and the difference per month. */
export async function monthlyReport(accountId: number) {
  return db
    .select({
      month: sql<string>`to_char(${financeEntries.entryDate}, 'YYYY-MM')`,
      out: sql<string>`coalesce(sum(${financeEntries.amountOut}), 0)`,
      in: sql<string>`coalesce(sum(${financeEntries.amountIn}), 0)`,
      entries: sql<number>`count(*)::int`,
    })
    .from(financeEntries)
    .where(eq(financeEntries.accountId, accountId))
    .groupBy(sql`1`)
    .orderBy(sql`1 desc`);
}

// ── Employees ───────────────────────────────────────────────────────────────

export async function listEmployees(storeId: number, archived: boolean) {
  const paid = db
    .select({
      employeeId: financeEntries.employeeId,
      paid: sql<string>`sum(${financeEntries.amountOut} - ${financeEntries.amountIn})`.as("paid"),
      lastPaid: sql<string>`max(${financeEntries.entryDate})`.as("last_paid"),
    })
    .from(financeEntries)
    .groupBy(financeEntries.employeeId)
    .as("paid");
  return db
    .select({
      id: employees.id,
      name: employees.name,
      wageBalance: employees.wageBalance,
      paid: sql<string>`coalesce(${paid.paid}, 0)`,
      lastPaid: paid.lastPaid,
    })
    .from(employees)
    .leftJoin(paid, eq(paid.employeeId, employees.id))
    .where(and(eq(employees.storeId, storeId), eq(employees.isArchived, archived)))
    .orderBy(asc(employees.name));
}

export async function countEmployees(storeId: number) {
  const rows = await db
    .select({ archived: employees.isArchived, n: count() })
    .from(employees)
    .where(eq(employees.storeId, storeId))
    .groupBy(employees.isArchived);
  return { active: rows.find((r) => !r.archived)?.n ?? 0, archived: rows.find((r) => r.archived)?.n ?? 0 };
}

/** Old employees/historywages: unpaid balance, wages added, payments made. */
export async function getEmployee(storeId: number, employeeId: number) {
  const [employee] = await db
    .select()
    .from(employees)
    .where(and(eq(employees.id, employeeId), eq(employees.storeId, storeId)));
  if (!employee) return null;
  const [accruals, payments] = await Promise.all([
    db
      .select({ id: wageAccruals.id, date: wageAccruals.accrualDate, amount: wageAccruals.amount, comment: wageAccruals.comment })
      .from(wageAccruals)
      .where(eq(wageAccruals.employeeId, employeeId))
      .orderBy(desc(wageAccruals.id)),
    db
      .select({
        id: financeEntries.id,
        date: financeEntries.entryDate,
        amountOut: financeEntries.amountOut,
        amountIn: financeEntries.amountIn,
        note: financeEntries.note,
        kind: financeEntries.kind,
      })
      .from(financeEntries)
      .where(eq(financeEntries.employeeId, employeeId))
      .orderBy(desc(financeEntries.id)),
  ]);
  return { employee, accruals, payments };
}

