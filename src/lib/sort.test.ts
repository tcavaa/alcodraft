import { describe, expect, it } from "vitest";

import { dec } from "./money";
import { nextSort, parseSort, sortRows, sortToParam } from "./sort";

describe("parseSort / sortToParam", () => {
  it("reads ascending and descending columns", () => {
    expect(parseSort("total", ["total", "date"])).toEqual({ column: "total", dir: "asc" });
    expect(parseSort("-date", ["total", "date"])).toEqual({ column: "date", dir: "desc" });
  });
  it("ignores unknown or empty values", () => {
    expect(parseSort("-password", ["total"])).toBeNull();
    expect(parseSort("", ["total"])).toBeNull();
    expect(parseSort(undefined, ["total"])).toBeNull();
  });
  it("round-trips", () => {
    expect(sortToParam({ column: "debt", dir: "desc" })).toBe("-debt");
    expect(sortToParam({ column: "name", dir: "asc" })).toBe("name");
    expect(sortToParam(null)).toBeNull();
  });
});

describe("nextSort (header click cycle)", () => {
  it("goes first direction → other direction → default", () => {
    const a = nextSort(null, "name", "asc");
    expect(a).toEqual({ column: "name", dir: "asc" });
    const b = nextSort(a, "name", "asc");
    expect(b).toEqual({ column: "name", dir: "desc" });
    expect(nextSort(b, "name", "asc")).toBeNull();
  });
  it("starts numbers/dates descending when asked", () => {
    const a = nextSort(null, "total", "desc");
    expect(a).toEqual({ column: "total", dir: "desc" });
    expect(nextSort(a, "total", "desc")).toEqual({ column: "total", dir: "asc" });
  });
  it("switching to another column starts over", () => {
    expect(nextSort({ column: "name", dir: "desc" }, "total", "desc")).toEqual({ column: "total", dir: "desc" });
  });
});

describe("sortRows", () => {
  const rows = [
    { name: "ბაზალეთი", total: "10.5", date: "2024-05-01" },
    { name: "Amazing", total: "100", date: null },
    { name: "ალაზანი", total: "-3", date: "2026-01-02" },
    { name: "", total: "9", date: "2025-12-31" },
  ];
  const by = {
    name: (r: (typeof rows)[number]) => r.name,
    total: (r: (typeof rows)[number]) => dec(r.total),
    date: (r: (typeof rows)[number]) => r.date,
  };

  it("sorts money exactly (not as text)", () => {
    expect(sortRows(rows, { column: "total", dir: "desc" }, by).map((r) => r.total)).toEqual(["100", "10.5", "9", "-3"]);
    expect(sortRows(rows, { column: "total", dir: "asc" }, by).map((r) => r.total)).toEqual(["-3", "9", "10.5", "100"]);
  });
  it("keeps empty values last in both directions", () => {
    expect(sortRows(rows, { column: "date", dir: "asc" }, by).map((r) => r.date)).toEqual(["2024-05-01", "2025-12-31", "2026-01-02", null]);
    expect(sortRows(rows, { column: "date", dir: "desc" }, by).map((r) => r.date)).toEqual(["2026-01-02", "2025-12-31", "2024-05-01", null]);
    expect(sortRows(rows, { column: "name", dir: "desc" }, by).at(-1)?.name).toBe("");
  });
  it("orders Georgian names alphabetically (Latin first)", () => {
    expect(sortRows(rows, { column: "name", dir: "asc" }, by).map((r) => r.name)).toEqual(["Amazing", "ალაზანი", "ბაზალეთი", ""]);
  });
  it("returns the default order when there is no sort", () => {
    expect(sortRows(rows, null, by)).toEqual(rows);
  });
});
