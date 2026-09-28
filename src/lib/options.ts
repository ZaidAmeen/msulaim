// Preset lists used by the voucher forms.

export const CLIENTS = ["KSS", "Rathod Fashions"] as const;

export const ITEMS = ["Crape", "Semi Chinnon", "Art Fancy"] as const;

export const PROCESSES = ["Finishing", "Blouse Stitch", "Piping", "Return", "Tassels"] as const;

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
