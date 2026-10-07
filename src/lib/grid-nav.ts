/**
 * Spreadsheet-like keys for the product grids: Enter / ↓ moves to the same column one row down,
 * ↑ one row up. Inputs carry `data-grid`, `data-row` and `data-col` (see `gridCell`).
 */
export function moveGridFocus(e: React.KeyboardEvent<HTMLInputElement>, grid: string, row: number, col: number) {
  const delta = e.key === "ArrowDown" || e.key === "Enter" ? 1 : e.key === "ArrowUp" ? -1 : 0;
  if (!delta) return;
  e.preventDefault();
  const next = document.querySelector<HTMLInputElement>(`[data-grid="${grid}"][data-row="${row + delta}"][data-col="${col}"]`);
  next?.focus();
  next?.select();
}

/** Props that make an input a cell of a keyboard-navigable grid. */
export function gridCell(grid: string, row: number, col: number) {
  return {
    "data-grid": grid,
    "data-row": row,
    "data-col": col,
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => moveGridFocus(e, grid, row, col),
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => e.target.select(),
  };
}

/** A whole number typed in a grid cell: "" = 0, anything else that isn't an integer = null. */
export function parseQty(raw: string | undefined): number | null {
  const t = (raw ?? "").trim();
  if (t === "") return 0;
  return /^-?\d+$/.test(t) ? Number(t) : null;
}
