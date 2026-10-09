import { describe, expect, it } from "vitest";

import { topPeriodStart } from "./top-periods";

describe("topPeriodStart (best sellers, today included)", () => {
  it("30 days back from today", () => {
    expect(topPeriodStart("2026-10-09", "30d")).toBe("2026-09-10");
    expect(topPeriodStart("2026-03-01", "30d")).toBe("2026-01-31");
  });

  it("6 months and a year end today, starting the day after", () => {
    expect(topPeriodStart("2026-10-09", "6m")).toBe("2026-04-10");
    expect(topPeriodStart("2026-10-09", "1y")).toBe("2025-10-10");
    expect(topPeriodStart("2026-12-31", "1y")).toBe("2026-01-01");
    expect(topPeriodStart("2026-08-31", "6m")).toBe("2026-03-01");
  });
});
