import { describe, expect, it } from "vitest";

import { formatAmount, parseAmount } from "./money";

describe("parseAmount", () => {
  it("reads what people type and what the app displays", () => {
    expect(parseAmount("1 234,50")?.toString()).toBe("1234.5");
    expect(parseAmount("-12.5")?.toString()).toBe("-12.5");
    // A displayed negative amount ("−" + thin spaces) can be pasted back.
    expect(parseAmount(formatAmount("-1234.5"))?.toString()).toBe("-1234.5");
  });

  it("rejects anything that is not a plain number", () => {
    for (const bad of ["30 ბენზინი", "1e5", "1,234.50", "", undefined]) expect(parseAmount(bad)).toBeNull();
  });
});
