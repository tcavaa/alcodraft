import { describe, expect, it } from "vitest";

import { isDirtyNumber, legacyDate, phpInt, phpNumber } from "./php";

// Expected values were produced by PHP 7.4.33 (`$value + 0` and `(int) $value`),
// the version the old Alcodraft app ran on.
const PHP_REFERENCE: [string, string, number][] = [
  ["", "0", 0],
  ["0", "0", 0],
  ["12", "12", 12],
  [" 30", "30", 30],
  ["30 ", "30", 30],
  ["30 ზაზას ბენზინი", "30", 30],
  ["1072,3", "1072", 1072],
  ["34437.5\t", "34437.5", 34437],
  ["ბალანსი: 0.90000000000009", "0", 0],
  [" 0.39999999999998", "0.39999999999998", 0],
  ["nika", "0", 0],
  ["ლ50", "0", 0],
  ["0ლ25", "0", 0],
  ["1-", "1", 1],
  ["-1", "-1", -1],
  ["O", "0", 0],
  ["0=5", "0", 0],
  ["2 ", "2", 2],
  [" 1", "1", 1],
  [".5", "0.5", 0],
  ["5.", "5", 5],
  ["1e3", "1000", 1000],
  ["+7", "7", 7],
  ["-", "0", 0],
  ["20000000000005", "20000000000005", 20000000000005],
  ["0.20000000000005", "0.20000000000005", 0],
  ["გასწორება", "0", 0],
  ["17.2 ", "17.2", 17],
  ["\n12", "12", 12],
  ["1 234", "1", 1],
];

describe("phpNumber / phpInt match PHP 7.4", () => {
  it.each(PHP_REFERENCE)("%j", (raw, asNumber, asInt) => {
    expect(phpNumber(raw).toString()).toBe(asNumber);
    expect(phpInt(raw)).toBe(asInt);
  });
});

describe("isDirtyNumber", () => {
  it("flags text that is not a plain number", () => {
    expect(isDirtyNumber("1072,3")).toBe(true);
    expect(isDirtyNumber("30 ")).toBe(true);
    expect(isDirtyNumber("")).toBe(false);
    expect(isDirtyNumber("-12.5")).toBe(false);
  });
});

describe("legacyDate", () => {
  it("converts dd/mm/YYYY", () => {
    expect(legacyDate("07/10/2026")).toBe("2026-10-07");
    expect(legacyDate("31/02/2026")).toBeNull();
    expect(legacyDate("2026-10-07")).toBeNull();
  });
});
