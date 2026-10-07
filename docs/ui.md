# UI & design system

## Brand

Taken from the AlcoDraft logo (`public/brand/alcodraft.jpg`): charcoal, antique gold, cream.

| Token | Use |
|---|---|
| `--primary` (charcoal; gold in dark mode) | primary buttons |
| `--gold`, `--gold-strong` | brand accents, focus ring, active nav, "accent" stat cards |
| `--sidebar*` | charcoal sidebar in both themes |
| `--success` / `--warning` / `--destructive` | income & customer credit / debt & warnings / expenses & errors |

Defined in `src/app/globals.css` (`:root` and `.dark`). Light/dark/system via the user menu (next-themes).

## Typography

- Geist (Latin, numbers) + Noto Sans Georgian (Georgian glyphs) — one `font-sans` stack.
- Cormorant Garamond for the "AlcoDraft" wordmark and the public page headline (`font-display`).
- All tables and amount inputs use tabular numbers.

## Page patterns

- `PageHeader` (eyebrow = store name, title, description, actions on the right; optional back link).
- Lists: toolbar (`SearchInput`, `ArchivedTabs` for active/„სანაგვე“, `ParamSelect`, `DateRangeFilter`,
  `CustomerFilter` / `ParamCombobox` for long lists) → `TableCard` with a `HeadRow` and `TableFooter`
  totals → `Pagination`. Filters live in the URL (shareable, back works). Toolbars wrap from the left
  (no `ml-auto` on a group that can wrap). `ParamSelect` keeps „label: value“ together on the left.
  Empty date fields show „დან“ / „მდე“ instead of the browser's placeholder date.
- **Every data table sorts by clicking a header** (`SortableHead`): first click → ↑ for text (A→Z) or ↓ for
  numbers and dates (biggest / newest first), second click → the other direction, third → the table's
  default order. Only the sorted column shows its gold arrow (no reserved space, so widths don't change).
  State is `?sort=col` / `?sort=-col`; a page with two tables gives the second its own param
  (`psort`, `rsort`, `asort`, `hsort`, `ssort`). Input grids (operation/order/receipt forms) are not
  sortable — rows would jump while typing.
- Long names in a cell: bound an inner `div` (`max-w-…`) and `truncate` the text with a `title`; a
  `td` ignores `max-width`, so text would spill into the next column.
- Row actions: `RowMenu` ("⋯") with confirmations in a dialog; quick inline edits (comment popovers,
  colour dot, RS status pill) update optimistically.
- Documents (operation, order, receipt): line table (`DocumentLinesTable`) + info card (`InfoRow`) on
  the right; `PrintButton`. Success banners: `Notice`. New/edit pages: `FormPage`.
- Big forms (operation/order/receipt): product grid with search, "only filled" toggle, keyboard
  navigation (Enter/↓/↑ move within a column), sticky summary panel with live totals and debt preview,
  confirmation dialog before saving. Edits show saved line totals for untouched products. An open
  order is completed or cancelled from its edit form (unsaved changes → „შენახვა და დასრულება“).
- Money forms (supplier payment, wages, receipts, edits) confirm with the amount before saving.
- Every route has a skeleton (`loading.tsx` → `PageSkeleton`), so navigation is instant.
- ⌘K / Ctrl+K: command palette — search customers, products, suppliers of the current store, jump to pages.

## Components

shadcn/ui ("radix-nova" preset) in `src/components/ui` — regenerate/add with `npx shadcn@latest add <name>`.
App-level shared components in `src/components` (`money.tsx`, `stat-card.tsx`, `row-menu.tsx` incl.
`archiveMenuItems`, `confirm-dialog.tsx`, `confirm-action.tsx`, `notice.tsx`, `info-list.tsx`,
`form-page.tsx`, `error-view.tsx`, `forms/*`, `data/*`, `layout/*`).

## Language

UI is Georgian. Keep the old app's wording for familiar actions: „დღის ჩახურვა“, „დარჩენილი“,
„აღებული თანხა“, „სულ ჯამში“, „შეტანილი“, „საჩუქარი“, „ნაშთი“, „სანაგვე“, „თვის ბრუნვა“.
