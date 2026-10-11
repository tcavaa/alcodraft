import { describe, expect, it } from "vitest";

import { formatPhone, localDigits, parseLegacyPhone } from "./phones";

describe("localDigits", () => {
  it("accepts 9 digits with or without +995, spaces and dashes", () => {
    expect(localDigits("557994849")).toBe("557994849");
    expect(localDigits("+995 557 99 48 49")).toBe("557994849");
    expect(localDigits("557-99-48-49")).toBe("557994849");
    expect(localDigits("0557994849")).toBe("557994849");
  });
  it("rejects other lengths", () => {
    expect(localDigits("5579948")).toBeNull();
    expect(localDigits("")).toBeNull();
  });
});

describe("parseLegacyPhone", () => {
  it("reads the old free-text formats", () => {
    expect(parseLegacyPhone("557 994 849").phones).toEqual([{ name: "", number: "557994849" }]);
    expect(parseLegacyPhone("557994849 - 599123456").phones.map((p) => p.number)).toEqual(["557994849", "599123456"]);
    expect(parseLegacyPhone("557994849-599123456").phones.map((p) => p.number)).toEqual(["557994849", "599123456"]);
    expect(parseLegacyPhone("557994849.   599123456").phones.map((p) => p.number)).toEqual(["557994849", "599123456"]);
    expect(parseLegacyPhone("557 994 849 - ნიკა 599 12 34 56").phones).toEqual([
      { name: "", number: "557994849" },
      { name: "ნიკა", number: "599123456" },
    ]);
  });
  it("puts the contact person on the first number and keeps the unreadable rest", () => {
    expect(parseLegacyPhone("+995 557 99 48 49", "გიორგი").phones).toEqual([{ name: "გიორგი", number: "557994849" }]);
    expect(parseLegacyPhone("2345", "ნინო")).toEqual({ phones: [{ name: "ნინო", number: "" }], rest: "2345" });
    expect(parseLegacyPhone("..")).toEqual({ phones: [], rest: "" });
  });
});

it("formats with the country code", () => {
  expect(formatPhone("557994849")).toBe("+995 557 99 48 49");
});
