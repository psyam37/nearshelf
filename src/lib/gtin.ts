// GTINs are the numbers under product barcodes (EAN-13 on most UK medicine
// packs). The last digit is a check digit, so a misread is usually caught.

/** Digits only, 8 to 14 long: the shapes a GTIN can have. */
export const GTIN_PATTERN = /^\d{8,14}$/;

/** The check digit for the digits before it (GS1 "mod 10" rule). */
export function gtinCheckDigit(digitsWithoutCheck: string): number {
  // From the right: weights alternate 3, 1, 3, 1, …
  let sum = 0;
  for (let i = 0; i < digitsWithoutCheck.length; i++) {
    const digit = Number(digitsWithoutCheck[digitsWithoutCheck.length - 1 - i]);
    sum += digit * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

/** True if `code` looks like a GTIN and its check digit is right. */
export function isValidGtin(code: string): boolean {
  if (!GTIN_PATTERN.test(code)) return false;
  return gtinCheckDigit(code.slice(0, -1)) === Number(code.at(-1));
}

/**
 * Turns what a scanner read into a GTIN we can look up, or null.
 * - A plain barcode (EAN-13, EAN-8, UPC-A) is already the GTIN.
 * - The square DataMatrix code on UK/EU medicine packs holds several fields;
 *   the GTIN follows "01", e.g. "0105012345678900" + batch, expiry, serial.
 * GTIN-14s starting with 0 are the same product as the EAN-13 without it.
 */
export function normaliseScannedCode(text: string): string | null {
  // GS1 DataMatrix: an optional "]d2" marker, then "01" and 14 digits.
  const dataMatrix = /^(?:\]d2)?01(\d{14})/.exec(text);
  const candidates = [text, dataMatrix?.[1]];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const code =
      candidate.length === 14 && candidate.startsWith("0") ? candidate.slice(1) : candidate;
    if (isValidGtin(code)) return code;
  }
  return null;
}
