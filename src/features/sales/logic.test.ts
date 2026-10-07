import { describe, expect, it } from "vitest";

import {
  balanceAfter,
  computeFinalLines,
  computeLines,
  debtAfter,
  leftoverValue,
  paymentHitsCashBook,
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
