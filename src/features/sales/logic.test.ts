import { describe, expect, it } from "vitest";

import {
  balanceAfter,
  computeFinalLines,
  computeLines,
  debtAfter,
  groupStoredLines,
  legacyCashEffect,
  leftoverValue,
  paymentHitsCashBook,
  planLineEdit,
  rediscountPrice,
  type StoredLine,
  stockDeltas,
  totalOf,
} from "./logic";

describe("computeLines (old distribution/add)", () => {
  it("applies the discount to the entered price and multiplies by the delivered quantity", () => {
    const lines = computeLines(
      [
        { productId: 1, price: "17", quantity: 3, giftQty: 1, leftoverQty: 0 },
        { productId: 2, price: "20", quantity: 0, giftQty: 0, leftoverQty: 0 },
        { productId: 3, price: "12.5", quantity: 2, giftQty: 0, leftoverQty: 4 },
      ],
      "0.85",
    );
    expect(lines).toHaveLength(2); // empty line dropped
    expect(lines[0].unitPrice.toString()).toBe("14.45"); // 17 × 0.85
    expect(lines[0].lineTotal.toString()).toBe("43.35"); // 3 × 14.45
    expect(lines[1].unitPrice.toString()).toBe("10.625");
    expect(lines[1].lineTotal.toString()).toBe("21.25");
    expect(totalOf(lines).toString()).toBe("64.6");
  });

  it("keeps a gift-only line (stock moves, nothing charged)", () => {
    const [line] = computeLines([{ productId: 1, price: "9", quantity: 0, giftQty: 2, leftoverQty: 0 }]);
    expect(line.lineTotal.toString()).toBe("0");
    expect(stockDeltas([line]).get(1)).toBe(-2);
  });

  it("allows negative quantities (returns recorded as a delivery)", () => {
    const [line] = computeLines([{ productId: 1, price: "10", quantity: -5, giftQty: 0, leftoverQty: 0 }]);
    expect(line.lineTotal.toString()).toBe("-50");
    expect(stockDeltas([line]).get(1)).toBe(5);
  });
});

describe("computeFinalLines (old orders/edit: price is already final)", () => {
  it("does not apply a discount again", () => {
    const [line] = computeFinalLines([{ productId: 1, unitPrice: "14.45", quantity: 2, giftQty: 0, leftoverQty: 0 }]);
    expect(line.lineTotal.toString()).toBe("28.9");
  });
});

describe("rediscountPrice (open order: discount changed)", () => {
  it("moves a final price to the new discount", () => {
    expect(rediscountPrice("8.5", "0.85", "0.9").toString()).toBe("9");
    expect(rediscountPrice("10", "1", "0.85").toString()).toBe("8.5");
    expect(rediscountPrice("2.8305", "0.85", "1").toString()).toBe("3.33");
  });

  it("comes back to the same price after several switches", () => {
    let price = rediscountPrice("3.33", "1", "0.7");
    price = rediscountPrice(price, "0.7", "0.6");
    price = rediscountPrice(price, "0.6", "1");
    expect(price.toString()).toBe("3.33");
  });
});

describe("running balances", () => {
  it("debt after = previous + total − paid (+ correction)", () => {
    expect(debtAfter("1497", "0", "500").toString()).toBe("997");
    expect(debtAfter("-49", "105", "0").toString()).toBe("56");
    expect(debtAfter("100", "0", "0", "-100").toString()).toBe("0");
  });

  it("cash balance = previous + income − expense", () => {
    expect(balanceAfter("1094.2", "0", "50").toString()).toBe("1044.2");
    expect(balanceAfter("-4744", "999.6", "0").toString()).toBe("-3744.4");
  });

  it("leftover value = Σ unit price × leftover", () => {
    expect(leftoverValue([{ unitPrice: "14.45", leftoverQty: 2 }, { unitPrice: "8", leftoverQty: 1 }]).toString()).toBe("36.9");
  });
});

describe("cash book", () => {
  it("skips 'back' payments and zero amounts like the old app", () => {
    expect(paymentHitsCashBook("cash", "10")).toBe(true);
    expect(paymentHitsCashBook("card", "10")).toBe(true);
    expect(paymentHitsCashBook("back", "10")).toBe(false);
    expect(paymentHitsCashBook("cash", "0")).toBe(false);
    expect(paymentHitsCashBook(null, "10")).toBe(false);
  });
});

describe("legacyCashEffect (imported operations without a linked cash entry)", () => {
  it("counts every payment except 'back' as booked, also when the old app saved no method", () => {
    expect(legacyCashEffect("cash", "30").toString()).toBe("30");
    expect(legacyCashEffect(null, "30").toString()).toBe("30");
    expect(legacyCashEffect("back", "30").toString()).toBe("0");
  });
});

describe("planLineEdit (editing a saved operation / order)", () => {
  // An imported operation: stored total 500 but rows add up to 480 (old edit page left it stale),
  // a product split over two rows, a line total that isn't price × qty, and a money-only row.
  const stored: StoredLine[] = [
    { id: 1, productId: 10, unitPrice: "17", quantity: 10, giftQty: 0, leftoverQty: 0, lineTotal: "170" },
    { id: 2, productId: 10, unitPrice: "17", quantity: 5, giftQty: 1, leftoverQty: 0, lineTotal: "85" },
    { id: 3, productId: 20, unitPrice: "20", quantity: 10, giftQty: 0, leftoverQty: 2, lineTotal: "205" },
    { id: 4, productId: 30, unitPrice: "5", quantity: 0, giftQty: 0, leftoverQty: 0, lineTotal: "20" },
  ];
  const asShown = [
    { productId: 10, unitPrice: "17", quantity: 15, giftQty: 1, leftoverQty: 0 },
    { productId: 20, unitPrice: "20.0000", quantity: 10, giftQty: 0, leftoverQty: 2 },
    { productId: 30, unitPrice: "5", quantity: 0, giftQty: 0, leftoverQty: 0 },
  ];

  it("groups saved rows per product the way the form shows them", () => {
    const views = groupStoredLines(stored);
    expect(views.get(10)).toMatchObject({ quantity: 15, giftQty: 1 });
    expect(views.get(10)!.lineTotal.toString()).toBe("255");
    expect(views.get(10)!.rows.map((r) => r.id)).toEqual([1, 2]);
  });

  it("keeps everything as saved when only the comment changed", () => {
    const plan = planLineEdit(stored, asShown, "500");
    expect(plan.keep.map((r) => r.id)).toEqual([1, 2, 3, 4]);
    expect(plan.remove).toEqual([]);
    expect(plan.add).toEqual([]);
    expect(plan.total.toString()).toBe("500"); // not Σ rows (480): the customer's debt doesn't move
  });

  it("treats products left out of the submission as unchanged", () => {
    expect(planLineEdit(stored, [], "500").total.toString()).toBe("500");
  });

  it("replaces only the changed product and keeps the old difference in the total", () => {
    const plan = planLineEdit(
      stored,
      asShown.map((l) => (l.productId === 20 ? { ...l, quantity: 8 } : l)),
      "500",
    );
    expect(plan.keep.map((r) => r.id)).toEqual([1, 2, 4]);
    expect(plan.remove.map((r) => r.id)).toEqual([3]);
    expect(plan.add).toHaveLength(1);
    expect(plan.add[0].lineTotal.toString()).toBe("160"); // 8 × 20
    expect(plan.total.toString()).toBe("455"); // 500 − 205 + 160
    expect([...stockDeltas(plan.remove, 1)]).toEqual([[20, 10]]);
  });

  it("merges a split product into one row once it is edited", () => {
    const plan = planLineEdit(
      stored,
      asShown.map((l) => (l.productId === 10 ? { ...l, quantity: 14 } : l)),
      "500",
    );
    expect(plan.remove.map((r) => r.id)).toEqual([1, 2]);
    expect(plan.add).toHaveLength(1);
    expect(plan.add[0]).toMatchObject({ productId: 10, quantity: 14, giftQty: 1 });
    expect(plan.total.toString()).toBe("483"); // 500 − 255 + 238
  });

  it("removes a cleared product and adds a new one", () => {
    const plan = planLineEdit(
      stored,
      [
        ...asShown.filter((l) => l.productId !== 30),
        { productId: 30, unitPrice: "5", quantity: 0, giftQty: 0, leftoverQty: 0 },
        { productId: 40, unitPrice: "9.5", quantity: 2, giftQty: 0, leftoverQty: 0 },
      ].map((l) => (l.productId === 20 ? { ...l, quantity: 0, leftoverQty: 0 } : l)),
      "500",
    );
    expect(plan.remove.map((r) => r.id)).toEqual([3]);
    expect(plan.add.map((l) => l.productId)).toEqual([40]); // product 20 cleared → no row
    expect(plan.total.toString()).toBe("314"); // 500 − 205 + 19
  });

  it("re-prices a product only when its price is changed", () => {
    const plan = planLineEdit(
      stored,
      asShown.map((l) => (l.productId === 20 ? { ...l, unitPrice: "21" } : l)),
      "500",
    );
    expect(plan.add[0].lineTotal.toString()).toBe("210");
    expect(plan.total.toString()).toBe("505");
  });
});
