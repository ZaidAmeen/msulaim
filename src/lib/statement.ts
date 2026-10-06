import { fmtDate } from "./date-format";
import { BUSINESS, MONTHS } from "./brand";

/** A ready-to-render statement (client delivery statement or partner outsourcing report). */
export type Statement = {
  kind: "client" | "partner" | "transport";
  name: string;
  from: string;
  to: string;
  title: string;
  header: string[];
  rows: string[][];
  /** Column indexes holding numbers (right-aligned on screen). */
  numericCols: number[];
  subtotals: [string, number][];
  grand: number;
  /** Row identifiers used to archive exactly these rows. */
  keys: string[];
};

const dmy = (d: string) => (d ? fmtDate(d).replace(/\//g, "-") : "");

/** Default file name: monthly for client/partner, date-to-date for transport. */
export function defaultFileName(s: Statement, month?: number, year?: number) {
  if (s.kind === "transport") {
    const to = s.to || new Date().toISOString().slice(0, 10);
    return `${s.name} Transport (${s.from ? dmy(s.from) : "Start"} to ${dmy(to)})`;
  }
  return `${s.name} Statement (${MONTHS[month ?? 0]} ${year ?? new Date().getFullYear()})`;
}

export function cleanFileName(n: string) {
  return n.replace(/[\\/:*?"<>|]/g, "-").trim() || "Statement";
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const label = (s: Statement) => (s.kind === "client" ? "Client" : "Partner");
export const statementLabel = label;

export function statementCsv(s: Statement): Blob {
  const n = s.header.length;
  const blank = (txt: string, val: string) => [
    ...Array(Math.max(0, n - 2)).fill(""),
    txt,
    val,
  ];
  const rows = [
    [`${label(s)}: ${s.name}`],
    [`Period: ${s.from ? fmtDate(s.from) : "start"} to ${s.to ? fmtDate(s.to) : "today"}`],
    [""],
    s.header,
    ...s.rows,
    [""],
    blank("Subtotal", ""),
    ...s.subtotals.map(([p, q]) => blank(p, String(q))),
    blank("Grand Total", String(s.grand)),
  ];
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  return new Blob([csv], { type: "text/csv" });
}

export async function statementPdf(s: Statement): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(BUSINESS.name, w / 2, 46, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(BUSINESS.tagline, w / 2, 62, { align: "center" });
  doc.text(BUSINESS.location, w / 2, 75, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(s.title, w / 2, 98, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`${label(s)}: ${s.name}`, 40, 122);
  const plain = { fillColor: [255, 255, 255] as [number, number, number], lineWidth: 0 };
  autoTable(doc, {
    startY: 134,
    head: [s.header],
    body: s.rows,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 5, halign: "center", valign: "middle" },
    headStyles: { fillColor: [46, 107, 240], halign: "center", valign: "middle" },
  });
  const y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16;
  autoTable(doc, {
    startY: y,
    margin: { left: w - 40 - 220 },
    tableWidth: 220,
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 4, halign: "center", valign: "middle", textColor: 20 },
    body: [
      [{ content: "Subtotal", colSpan: 2, styles: { fontStyle: "bold", halign: "left", ...plain } }],
      ...s.subtotals.map(([p, q]) => [{ content: p, styles: { halign: "left" as const } }, String(q)]),
      [
        { content: "Grand Total", styles: { fontStyle: "bold", halign: "left" } },
        { content: String(s.grand), styles: { fontStyle: "bold" } },
      ],
    ],
    didDrawCell: (data) => {
      if (data.section === "body" && data.row.index === s.subtotals.length + 1) {
        const { x, y: cy, width, height } = data.cell;
        doc.setDrawColor(20);
        doc.setLineWidth(0.8);
        doc.line(x, cy, x + width, cy);
        doc.line(x, cy + height, x + width, cy + height);
        doc.line(x, cy + height + 2.5, x + width, cy + height + 2.5);
      }
    },
  });
  return doc.output("blob");
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}
