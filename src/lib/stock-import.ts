// Reading a stock report exported from a PMR (ProScript Connect, Titan and
// others) and turning it into NearShelf stock levels. Every PMR lays its CSV
// out a little differently, so this looks for familiar column names instead
// of one fixed format. Pure functions: no database, easy to test.
import { normaliseScannedCode } from "@/lib/gtin";
import type { StockLevel } from "@/lib/types";

/** Splits CSV text into rows, handling quotes. Works out the separator. */
export function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const separator = [",", ";", "\t"].reduce((best, sep) =>
    firstLine.split(sep).length > firstLine.split(best).length ? sep : best,
  );

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === separator) {
      row.push(cell.trim());
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim());
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell.trim());
  if (row.some((c) => c !== "")) rows.push(row);
  return rows;
}

// Column names PMR exports commonly use, lower-case.
const COLUMN_NAMES = {
  barcode: ["barcode", "ean", "gtin", "ean13", "ean code", "product barcode"],
  name: [
    "description",
    "product",
    "product name",
    "item",
    "item description",
    "drug",
    "name",
    "product description",
  ],
  quantity: [
    "quantity",
    "qty",
    "stock",
    "on hand",
    "in stock",
    "stock level",
    "current stock",
    "balance",
    "qty in stock",
    "stock qty",
  ],
} as const;

export interface ColumnMap {
  barcode: number | null;
  name: number | null;
  quantity: number;
}

/** Finds the barcode, name and quantity columns in the header row. */
export function findColumns(header: string[]): ColumnMap | null {
  const lower = header.map((h) =>
    h
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, "")
      .trim(),
  );
  const find = (names: readonly string[]) => {
    const exact = lower.findIndex((h) => names.includes(h));
    if (exact >= 0) return exact;
    const partial = lower.findIndex((h) => names.some((n) => h.includes(n)));
    return partial >= 0 ? partial : null;
  };
  const quantity = find(COLUMN_NAMES.quantity);
  const barcode = find(COLUMN_NAMES.barcode);
  const name = find(COLUMN_NAMES.name);
  if (quantity === null || (barcode === null && name === null)) return null;
  return { barcode, name, quantity };
}

export interface CatalogueMedicine {
  id: string;
  name: string;
  strength: string | null;
  form: string | null;
}

// Short forms PMRs use for dosage forms.
const FORM_WORDS: Record<string, string[]> = {
  tablet: ["tablet", "tablets", "tab", "tabs"],
  capsule: ["capsule", "capsules", "cap", "caps"],
  gel: ["gel"],
  "oral suspension": ["suspension", "susp", "oral susp"],
  inhaler: ["inhaler", "inh"],
  "auto-injector": ["auto-injector", "autoinjector", "pen", "injector"],
  "pre-filled pen": ["pen", "prefilled", "pre-filled"],
};

const compact = (s: string) => s.toLowerCase().replace(/\s+/g, "");

/**
 * The catalogue medicine a PMR description means, or null. It needs the drug
 * and the strength to match (so 50mg never matches 100mg), and the form too
 * when that's still ambiguous.
 */
export function matchByName(
  description: string,
  catalogue: CatalogueMedicine[],
): CatalogueMedicine | null {
  const text = description.toLowerCase();
  const textCompact = compact(description);
  const candidates = catalogue.filter((m) => {
    const drug = m.name.toLowerCase().split(/\s+/)[0];
    const strengthOk = !m.strength || textCompact.includes(compact(m.strength));
    return text.includes(drug) && strengthOk;
  });
  if (candidates.length <= 1) return candidates[0] ?? null;

  const byForm = candidates.filter((m) => {
    const words = (m.form && FORM_WORDS[m.form]) || (m.form ? [m.form] : []);
    return words.some((w) => new RegExp(`(^|[^a-z])${w}([^a-z]|$)`).test(text));
  });
  return byForm.length === 1 ? byForm[0] : null;
}

export interface ImportRow {
  medicineId: string;
  level: StockLevel;
}

export interface ImportResult {
  rows: ImportRow[];
  unmatched: string[];
  total: number;
}

/** Reads a whole report. `lowAt`: a quantity at or below this is "Low". */
export function readStockReport(
  csv: string,
  catalogue: CatalogueMedicine[],
  barcodes: Map<string, string>, // GTIN → medicine id
  lowAt: number,
): ImportResult | { error: string } {
  const [header, ...body] = parseCsv(csv);
  if (!header) return { error: "That file is empty." };
  const columns = findColumns(header);
  if (!columns) {
    return {
      error:
        "Couldn't find the columns. The report needs a quantity column and a barcode or description column.",
    };
  }

  const byMedicine = new Map<string, number>(); // the same medicine can appear in several rows
  const unmatched: string[] = [];
  for (const cells of body) {
    const quantity = Number((cells[columns.quantity] ?? "").replace(/[^0-9.-]/g, ""));
    if (!Number.isFinite(quantity)) continue;

    const gtin =
      columns.barcode !== null ? normaliseScannedCode(cells[columns.barcode] ?? "") : null;
    const description = columns.name !== null ? (cells[columns.name] ?? "") : "";
    const medicineId =
      (gtin && barcodes.get(gtin)) ||
      (description && matchByName(description, catalogue)?.id) ||
      null;

    if (medicineId) byMedicine.set(medicineId, (byMedicine.get(medicineId) ?? 0) + quantity);
    else if (description || gtin) unmatched.push(description || gtin || "");
  }

  const rows = [...byMedicine].map(([medicineId, quantity]) => ({
    medicineId,
    level: (quantity <= 0 ? "out_of_stock" : quantity <= lowAt ? "low" : "in_stock") as StockLevel,
  }));
  return { rows, unmatched, total: body.length };
}
