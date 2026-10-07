import { describe, expect, it } from "vitest";

import { dateRangeParam, enumParam, intParam, parseId } from "./search-params";

describe("route and query parameters", () => {
  it("accepts only positive ids that fit a Postgres integer", () => {
    expect(parseId("42")).toBe(42);
    expect(parseId(" 7 ")).toBe(7);
    expect(parseId("2147483647")).toBe(2147483647);
    for (const bad of ["0", "-1", "abc", "1.5", "2147483648", "99999999999", "", undefined]) {
      expect(parseId(bad)).toBeNull();
    }
  });

  it("drops query ids that are too large for the database", () => {
    expect(intParam({ customer: "12" }, "customer")).toBe(12);
    expect(intParam({ customer: "99999999999" }, "customer")).toBeUndefined();
  });

  it("parses enum and date filters, ignoring junk", () => {
    expect(enumParam({ dir: "in" }, "dir", ["in", "out"] as const)).toBe("in");
    expect(enumParam({ dir: "sideways" }, "dir", ["in", "out"] as const)).toBeUndefined();
    expect(dateRangeParam({ from: "2026-10-01", to: "2026-02-30" })).toEqual({ from: "2026-10-01", to: undefined });
  });
});
