// Draws EAN-13 barcodes: turns 13 digits into 95 thin black/white stripes.
// https://en.wikipedia.org/wiki/International_Article_Number#Binary_encoding_of_data_digits_into_EAN-13_barcode

// Each digit is 7 stripes ("1" = black). There are three ways to write a digit.
const L_CODES = ["0001101", "0011001", "0010011", "0111101", "0100011",
                 "0110001", "0101111", "0111011", "0110111", "0001011"]; // prettier-ignore
const invert = (bits: string) => [...bits].map((b) => (b === "1" ? "0" : "1")).join("");
const R_CODES = L_CODES.map(invert);
const G_CODES = R_CODES.map((bits) => [...bits].reverse().join(""));

// The first digit isn't drawn directly: it picks which of L/G each of the
// next six digits uses.
const PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG",
                "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"]; // prettier-ignore

/** "1010…" — 95 stripes for a 13-digit code. Throws if it isn't 13 digits. */
export function ean13Stripes(code: string): string {
  if (!/^\d{13}$/.test(code)) throw new Error(`EAN-13 needs 13 digits, got "${code}"`);
  const digits = [...code].map(Number);
  const parity = PARITY[digits[0]];

  const left = digits
    .slice(1, 7)
    .map((d, i) => (parity[i] === "L" ? L_CODES[d] : G_CODES[d]))
    .join("");
  const right = digits
    .slice(7)
    .map((d) => R_CODES[d])
    .join("");

  // Start guard, left half, centre guard, right half, end guard.
  return `101${left}01010${right}101`;
}
