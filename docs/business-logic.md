# Business logic

Every rule below was read from the old PHP app (`public_html/application/controllers/admin/*`,
views in `views/admin/*`) and verified against its data. Pure formulas live in
`src/features/sales/logic.ts` (unit-tested); transactional rules in `src/features/*/service.ts`.
Georgian terms in quotes are the labels users know.

## Operations — „ოპერაცია“ (old `distribution`)

Created from the customer page / „დღის ჩახურვა“ form (`createDelivery`).

| Rule | Formula / behaviour | Old source |
|---|---|---|
| Unit price | entered price × discount factor (`sale`: 1, 0.9, 0.85, 0.8, 0.75, 0.7, 0.6) | `distribution/add`: `drink_price = value*sale` |
| Line total | „შეტანილი“ (delivered) × unit price | `drink_sum = drink_in*value*sale` |
| Total „სულ ჯამში“ | Σ line totals | `fullamount` |
| Debt after „დარჩენილი“ | previous debt + total − „აღებული თანხა“ (paid) | `darchenili = fullamount + lastday[1].darchenili − money` |
| Stock | product stock −= delivered + gift („საჩუქარი“) | two loops in `distribution/add` |
| Stock check | delivered may not exceed stock on hand (gift is not checked) | `<input max=count>` on the form |
| Cash book | if method ≠ „დაბრუნება“ (`back`) and paid ≠ 0: income = paid into the store's default book, text `"<customer name> <method>"` | `finance_model->add` unless `pay_meth == 'back'` |
| „ნაშთი“ (leftover) | recorded per line; informational only: „დარჩენილი“ column = delivered − leftover, summary „ნაშთი“ = Σ unit price × leftover | `distribution/view` |
| Payment only | an operation with no lines and paid > 0 is a customer payment (shown as „გადახდა“) | same form with zero quantities |
| Price highlight | unit price shown in amber when it differs from the product's current price | red `style` in `distribution/view` |

`back` = the customer settled with returned goods: the debt drops by the amount, the cash book doesn't
change. (The returned goods themselves go back to stock through a receipt from the "returns" supplier.)

### Editing and deleting (improved)

The old edit page (reachable only by URL) changed quantities and stock but left `fullamount` and all
debts stale; the old delete referenced a column that no longer existed. Now:

- **Edit** (`updateDelivery`): lines (final unit prices), paid, method, waybill, comment.
  - Products the user doesn't change keep their saved rows exactly, line totals included; a changed
    product is replaced by one recomputed row (`planLineEdit` in `logic.ts`, unit-tested). The total
    becomes *saved total − removed rows + new rows*: an imported operation whose old total never
    matched its rows (the old edit page left `fullamount` stale) keeps that difference, so fixing a
    comment never moves a debt. The edit form shows the saved line totals and the kept difference.
  - What an edit adds follows the rules of a new operation: the extra „შეტანილი“ must be in stock,
    archived products can't be added, and an operation can't be left with no lines and nothing paid
    (that is a delete, which only a super admin does).
  - An empty payment method / waybill (imported rows) stays empty unless the user sets one; a method
    that is set can't be removed.
  - Stock moves by the difference; the debt of this and every later operation follows automatically
    (window sum). Cash: the linked entry is updated/removed (a removed imported entry that carries an
    old correction keeps the correction as its own row); an operation without a linked entry gets
    an appended correction for the difference, by the old app's rule (every payment except `back`
    was booked — including rows saved before the old app recorded a method).
- **Delete** (`deleteDelivery`, super admin): stock restored, cash removed/reversed the same way,
  a completed order is reopened. An imported operation that carries an old manual correction
  (`adjustment_amount ≠ 0`) is turned into a correction row instead (kind `adjustment`, same number
  and place in the history), so the debt after every later operation stays as it was; deleting that
  correction row then removes it. A delete only runs if the row is still what the person confirmed
  (an operation or a correction), so a second click from another tab can't remove the kept correction.

### Debt corrections (new)

„ვალის კორექტირება“ creates an operation of kind `adjustment` (no lines, total 0, paid 0,
`adjustment_amount` = ±amount, reason required). Replaces editing `darchenili` in phpMyAdmin.

## Orders — „შეკვეთა“ (old `orders`)

| Step | Behaviour | Old source |
|---|---|---|
| Create | same lines and discount as an operation; **no stock or cash change**; `debt_snapshot` = customer's current debt, or the order total if the customer has no operations yet | `orders/add` |
| Edit | prices are final per line (discount not re-applied, not changeable); qty, gift, leftover, paid, method, waybill, RS status, comment; untouched products keep their saved rows (as for operations) | `orders/edit` |
| Complete „შეკვეთის დასრულება“ | creates an operation with the same lines/values and the order's saved total: stock −= delivered + gift (**no stock check**), cash entry as above, debt formula; order → completed and linked. Changes still unsaved on the order page are saved first, in the same transaction („შენახვა და დასრულება“). An order with money paid but no method (imported) needs a method first | `orders/finish` |
| Cancel „გაუქმება“ | status cancelled (old status 3) | `orders/disable` |
| Quick edits | RS status (ასატვირთი/ატვირთული) and comment editable from the lists, any status; the RS status of a completed order is copied to its operation | inline forms in `orders/index`, `ordershistory`, `all` |
| All orders | open orders of every store the user can open | `orders/all` (stores 1, 4, 5, 6 only) |

The order form warns (doesn't block) when a quantity exceeds stock — stock may arrive before delivery.

## Stock receipts — „მიღება“ (old `drinks/stock`, `drinks_history`)

- For each product: stock += received quantity; the line stores the stock before and the purchase
  price paid („შემოტანის ფასი“, pre-filled with the product's purchase price; required).
- The product's purchase price is **not** changed by a receipt; the receipt page shows a differing
  price in amber (old: red).
- The form lists the chosen supplier's products; the "returns" supplier (old supplier id 4,
  „დაბრუნებული — არ წაშალოთ“) lists all products. New: a "ყველა პროდუქტი" toggle for any supplier.
- Delete (super admin) takes the quantities back out of stock.

## Suppliers — „მომწოდებელი“ (old `drinks/historylistmomw`)

- To pay „სულ გადასახდელი“ = Σ over the supplier's receipts of quantity × unit cost.
- Paid = Σ cash-book expenses (`amount_out`) linked to the supplier (old: every finance row whose
  comment equals the supplier's name — imported rows were linked by that exact rule). Income rows
  linked to a supplier don't count. The list and the supplier page use the same expression
  (`supplierPaidSum` in `src/server/db/expressions.ts`).
- Remaining „დარჩა“ = to pay − paid. Paying writes an expense with the supplier's name as text and the
  note as the second comment (old `comment2`).
- **Difference:** the old page cut every receipt total and payment to whole lari (`(int)` cast). The new
  one is exact; the import report lists suppliers where this changes the remaining amount.

## Customers — „კლიენტები“ (old `company`)

- Current debt = sum over all operations (= the old latest `darchenili`).
- List totals: store 1's old page summed debts including negatives, stores 2–6 counted only positive
  debts. New page shows both: „მისაღები“ (Σ positive) and „ზედმეტად გადახდილი“ (Σ negative).
- Colour (red/yellow/green row highlight) and a free-text comment. The old form re-stamped
  `dd-mm-YYYY - ` in front of the comment on every save; now an „თარიღის ჩასმა“ button does it on demand.
- „ყველა დღე ერთად“ (old `viewsum`): per product Σ delivered, Σ leftover, delivered − leftover, Σ gift,
  Σ line totals, average price = Σ line totals ÷ Σ delivered; products with Σ delivered > 0 only.
  (Old page also counted item rows of deleted operations and of operations later moved to another
  customer — see the import report.)
- Archive („სანაგვე“) keeps history; hard delete only for customers without operations/orders.

## Products — „პროდუქცია“ (old `drinks`)

- Fields: name, supplier, price („ფასი“), purchase price („შემოტანის ფასი“), stock.
- Price history „შეცვლის ისტორია“: old app saved the previous prices on **every** edit; now only when a
  price actually changes, and the new prices are saved too.
- Inventory correction „ინვენტარიზაცია“ (new): set the real count with a reason → `stock_adjustments`.
  Refused when the stock changed after the dialog opened (a receipt or sale meanwhile), so a count
  can't silently wipe that movement.
- Hard delete (super admin) only for products that never appeared anywhere; suppliers only without
  receipts **and** payments.

## Cash book — „სალარო“ (old `finance`)

- Balance after an entry = previous balance − expense („ხარჯი“) + income („შემოსავალი“).
- Manual entries: expense and/or income + comment (old `finance/add`).
- The old list hid rows where both amounts were 0; those rows are not imported/created (they never
  changed a balance).
- Monthly report „თვის ბრუნვა“: per month Σ expense, Σ income, income − expense.
  **Difference:** the old monthly page read amounts with `floatval(str_replace([',', ' '], ''))`, so a
  typo like `1072,3` counted as 10723 there but as 1072 in the balance. The new report uses the same
  value as the balance. Affected months are listed in the import report.
- Stores can have several books; automatic entries go to the default one.
- Delete (super admin): not for entries that belong to an operation (edit the operation instead);
  deleting a wage payment gives the amount back to the employee's balance. An imported entry that
  also carries an old manual balance correction keeps the correction (amounts zeroed, same place),
  so later balances don't move.

## Wages — „ხელფასები“ (old `employees`, `historywages`)

- `wage_balance` = wages owed and not yet paid (old `employees.wage`).
- Accrue „დარიცხვა“: adds a `wage_accruals` row and increases the balance.
- Pay „გაცემა“: cash-book expense (text = employee name, note) and decreases the balance.
- Editing an employee may overwrite the balance directly (old edit form did the same). The form sends
  the balance it showed: if a wage was accrued or paid meanwhile, an unchanged field keeps the new
  balance and a changed one is refused (no silent undo of a payment).

## Double submits

Creates that move money or stock (operation, order, receipt, cash entry, supplier payment, wage
accrual/payment, debt correction) send a one-time request id from the form. The server records it in
the same transaction (`request_keys`, `once()` in `src/server/db/once.ts`): a double click or a retry
after a lost connection (the form stays filled in, with the same id) gets the first result instead of
a second document. Two separate tabs are two separate requests.

## Numbers typed by people

The old app stored text and PHP read only the leading number (`"1072,3"` → 1072,
`"30 ბენზინი"` → 30). New inputs accept `1234,5` or `1234.5` (spaces allowed) and **reject** anything
else with a Georgian message. The import reproduced the old PHP reading exactly (see
`scripts/legacy/php.ts`).
