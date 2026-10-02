/** Format any sheet date string as DD/MM/YYYY; returns the input unchanged if unparseable. */
export function fmtDate(value: string): string {
  const s = String(value ?? "").trim();
  if (!s) return "";
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${(iso[3] ?? "").padStart(2, "0")}/${(iso[2] ?? "").padStart(2, "0")}/${iso[1]}`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

/** Finishing first, extras in the middle, Return last. */
export function processRank(p: string): number {
  const t = p.trim().toLowerCase();
  if (t === "finishing") return 0;
  if (t === "return") return 2;
  return 1;
}
