// Preset lists used by the voucher forms.
// Edit these lists to match your business.

export const CLIENTS = [
  "Northwind Coffee Co.",
  "Apex Textiles",
  "Blue River Garments",
  "Crescent Apparel",
  "Delta Fabrics",
] as const;

export const ITEMS = [
  "Cotton Shirts",
  "Trousers",
  "T-Shirts",
  "Denim Jackets",
  "Bed Sheets",
  "Towels",
] as const;

export const PROCESSES = [
  "Dyeing",
  "Printing",
  "Washing",
  "Stitching",
  "Finishing",
  "Packing",
] as const;

/** Preset list plus any values already saved in the sheet, de-duplicated. */
export function withExisting(preset: readonly string[], existing: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of [...preset, ...existing]) {
    const t = v.trim();
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
  }
  return out;
}
