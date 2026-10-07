import mysql from "mysql2/promise";

export type LegacyRow = Record<string, string | null>;

/** Read-only connection to the local MySQL copy of the old database. */
export async function openLegacy(url = process.env.LEGACY_DATABASE_URL) {
  if (!url) throw new Error("LEGACY_DATABASE_URL is not set (see .env.example).");
  const conn = await mysql.createConnection({
    uri: url,
    charset: "utf8mb4",
    dateStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: true,
    // Everything is text in the old schema; keep raw strings so PHP coercion can be replayed.
    typeCast: (field, next) => {
      if (field.type === "LONG" || field.type === "LONGLONG" || field.type === "TINY") {
        const value = field.string();
        return value === null ? null : value;
      }
      return next();
    },
  });

  async function rows(sql: string, params: unknown[] = []): Promise<LegacyRow[]> {
    const [result] = await conn.query({ sql, values: params, rowsAsArray: false });
    return (result as Record<string, unknown>[]).map((r) => {
      const out: LegacyRow = {};
      for (const [k, v] of Object.entries(r)) out[k] = v === null || v === undefined ? null : String(v);
      return out;
    });
  }

  async function tableExists(table: string): Promise<boolean> {
    const [result] = await conn.query(
      "SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?",
      [table],
    );
    return (result as unknown[]).length > 0;
  }

  async function autoIncrement(table: string): Promise<number> {
    const [result] = await conn.query(
      "SELECT AUTO_INCREMENT AS ai FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?",
      [table],
    );
    const value = (result as { ai: number | string | null }[])[0]?.ai;
    return value === null || value === undefined ? 1 : Number(value);
  }

  return { rows, tableExists, autoIncrement, close: () => conn.end() };
}

export type Legacy = Awaited<ReturnType<typeof openLegacy>>;

/** Item tables keep a row for every product on every form; skip rows that are literally all zero. */
export const NON_ZERO_ITEM_FILTER = `NOT (
  drink_in IN ('0', '') AND drink_gift IN ('0', '') AND drink_out IN ('0', '') AND drink_sum IN ('0', '')
)`;
