/**
 * Customer row colours, in the order the list sorts and the pickers show them. The old app had
 * only red, yellow and green; blue, black and white are new. Must match the `customer_color` enum.
 */
export const CUSTOMER_COLORS = ["red", "yellow", "green", "blue", "black", "white"] as const;

export type CustomerColor = (typeof CUSTOMER_COLORS)[number];

export const CUSTOMER_COLOR_LABEL: Record<CustomerColor, string> = {
  red: "წითელი",
  yellow: "ყვითელი",
  green: "მწვანე",
  blue: "ლურჯი",
  black: "შავი",
  white: "თეთრი",
};
