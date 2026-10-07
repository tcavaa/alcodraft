import { describe, expect, it } from "vitest";

import { parseConnectionString } from "./connection-string";

describe("parseConnectionString", () => {
  const base = "postgresql://postgres.ref:PASSWORD@aws-1-eu-central-1.pooler.supabase.com:6543/postgres";
  it.each(["plain123", "p@ss#w/rd?x", "a:b%41c", "with space", "ends@"])("keeps the raw password %j", (pw) => {
    const c = parseConnectionString(base.replace("PASSWORD", pw));
    expect(c.password).toBe(pw);
    expect(c.user).toBe("postgres.ref");
    expect(c.host).toBe("aws-1-eu-central-1.pooler.supabase.com");
    expect(c.port).toBe(6543);
    expect(c.database).toBe("postgres");
  });
  it("reads query params", () => {
    expect(parseConnectionString(`${base}?sslmode=require`).params.get("sslmode")).toBe("require");
  });
});
