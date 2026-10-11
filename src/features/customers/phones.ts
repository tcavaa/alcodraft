/**
 * A customer's phone numbers (new): any number of `{ name, number }` rows, `number` = the 9 local
 * digits (Georgia, +995 is fixed). Saved in `customers.phones`; `customers.phone` /
 * `contactPerson` keep the numbers / names joined for search and old screens.
 *
 * Customers saved before this kept one free-text `phone` (old `number`) and `contactPerson`; until
 * they are edited again their numbers are read from that text (`customerPhones`).
 */
export interface CustomerPhone {
  name: string;
  number: string;
}

export const PHONE_COUNTRY_CODE = "+995";
export const PHONE_DIGITS = 9;

/** "557994849" → "557 99 48 49". */
export function formatLocalPhone(number: string): string {
  return /^\d{9}$/.test(number) ? `${number.slice(0, 3)} ${number.slice(3, 5)} ${number.slice(5, 7)} ${number.slice(7)}` : number;
}

/** "557994849" → "+995 557 99 48 49". */
export function formatPhone(number: string): string {
  return `${PHONE_COUNTRY_CODE} ${formatLocalPhone(number)}`;
}

export function telHref(number: string): string {
  return `tel:${PHONE_COUNTRY_CODE}${number}`;
}

/** The 9 local digits of a typed number ("+995 557-99-48-49" → "557994849"), or null. */
export function localDigits(text: string): string | null {
  let digits = text.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("995")) digits = digits.slice(3);
  if (digits.length === 10 && digits.startsWith("0")) digits = digits.slice(1);
  return digits.length === PHONE_DIGITS ? digits : null;
}

/**
 * Numbers in an old free-text `phone` ("557 99 48 49 - ნიკა 599 12 34 56", "+995 557 994 849").
 * `rest` = what could not be read as a number (shown on the edit form so nothing is lost).
 */
export function parseLegacyPhone(text: string, contactPerson = ""): { phones: CustomerPhone[]; rest: string } {
  const phones: CustomerPhone[] = [];
  const rest: string[] = [];
  const chunks = text
    .replace(/ /g, " ")
    .split(/[,;/\\]|\s-\s|-(?=\s*\+?\d{3})|\.\s*/)
    .map((c) => c.trim())
    .filter(Boolean);
  for (const chunk of chunks) {
    const number = localDigits(chunk);
    if (number) {
      phones.push({ name: chunk.replace(/[\d+()\-.\s]+/g, " ").trim(), number });
    } else if (/[\p{L}\d]/u.test(chunk)) {
      rest.push(chunk);
    }
  }
  const person = contactPerson.trim();
  if (person) {
    if (phones.length > 0 && !phones[0].name) phones[0].name = person;
    else if (phones.length === 0) phones.push({ name: person, number: "" });
  }
  return { phones, rest: rest.join(", ") };
}

/** What to show for a customer: the saved list, or what can be read from the old text. */
export function customerPhones(c: { phones: CustomerPhone[]; phone: string; contactPerson: string }) {
  return c.phones.length > 0 ? { phones: c.phones, rest: "" } : parseLegacyPhone(c.phone, c.contactPerson);
}
