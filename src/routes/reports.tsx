import { isBaseProcess } from "@/lib/options";
import { fmtDate, processRank } from "@/lib/date-format";
import { createFileRoute, type ErrorComponentProps } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { boardQuery } from "@/lib/voucher-queries";
import { num } from "@/lib/voucher-utils";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Client statement — M Sulaim" },
      {
        name: "description",
        content: "Delivery statement per client for any date range, exportable as CSV.",
      },
      { property: "og:title", content: "Client statement — M Sulaim" },
      {
        property: "og:description",
        content: "Delivered items per client between any two dates, exportable as CSV.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(boardQuery),
  component: Reports,
  errorComponent: ({ error }: ErrorComponentProps) => (
    <AppShell title="Reports">
      <div className="frost rounded-2xl p-4 text-[13px] text-inkmuted">{(error as Error).message}</div>
    </AppShell>
  ),
  notFoundComponent: () => <AppShell title="Not found">Nothing here.</AppShell>,
});

type Line = {
  date: string;
  deliveryNo: string;
  clientVoucherNo: string;
  client: string;
  item: string;
  process: string;
  ordered: number | null;
  quantity: number;
};

/** Normalise a sheet date string to YYYY-MM-DD for comparison/sorting. */
function dateKey(date: string): string {
  const d = new Date(date);
  if (!Number.isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;
  }
  return "";
}

function todayKey(): string {
  return dateKey(new Date().toISOString());
}

function firstOfMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/** Numeric voucher comparison: 2 before 10, falls back to text for non-numeric. */
function voucherCompare(a: string, b: string): number {
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb) && a.trim() !== "" && b.trim() !== "") {
    return na - nb;
  }
  return a.localeCompare(b, undefined, { numeric: true });
}

function Reports() {
  const { data: board } = useSuspenseQuery(boardQuery);

  const [from, setFrom] = useState(firstOfMonthKey);
  const [to, setTo] = useState(todayKey);

  const voucherInfo = useMemo(() => {
    const map = new Map<string, { date: string; ordered: number }>();
    for (const v of board.clientVouchers) {
      const vk = v.voucherNo.trim().toLowerCase();
      map.set(vk, { date: v.date, ordered: num(v.quantity) });
      for (const i of v.items)
        map.set(`${vk}|${i.item.trim().toLowerCase()}`, { date: v.date, ordered: num(i.quantity) });
    }
    return map;
  }, [board]);

  const lines = useMemo<Line[]>(
    () =>
      board.deliveryVouchers
        .map((d) => {
          const vk = d.clientVoucherNo.trim().toLowerCase();
          const info =
            voucherInfo.get(`${vk}|${d.item.trim().toLowerCase()}`) ?? voucherInfo.get(vk);
          return {
            // Date shown/filtered is the client voucher's date.
            date: info?.date || d.date,
            deliveryNo: d.deliveryNo,
            clientVoucherNo: d.clientVoucherNo,
            client: d.clientName || "—",
            item: d.item || "—",
            process: d.process || "—",
            ordered: info?.ordered ?? null,
            quantity: num(d.quantity),
          };
        })
        .filter((l) => {
          const k = dateKey(l.date);
          if (!k) return true;
          return (!from || k >= from) && (!to || k <= to);
        })
        .sort(
          (a, b) =>
            a.client.localeCompare(b.client) ||
            voucherCompare(a.clientVoucherNo, b.clientVoucherNo) ||
            a.item.localeCompare(b.item) ||
            processRank(a.process) - processRank(b.process) ||
            dateKey(a.date).localeCompare(dateKey(b.date)) ||
            voucherCompare(a.deliveryNo, b.deliveryNo),
        ),
    [board, from, to, voucherInfo],
  );

  const byClient = useMemo(() => {
    const map = new Map<string, Line[]>();
    for (const l of lines) map.set(l.client, [...(map.get(l.client) ?? []), l]);
    return [...map.entries()];
  }, [lines]);

  const HEADER = ["Date", "VC No.", "Item", "Process", "Quantity", "DC No.", "Delivered Quantity"];

  /** Table rows; ordered quantity shown only on the first row of each client voucher. */
  function buildRows(clientLines: Line[]): string[][] {
    const seen = new Set<string>();
    return clientLines.map((l) => {
      const key = `${l.clientVoucherNo.trim().toLowerCase()}|${l.item.trim().toLowerCase()}`;
      const first = !seen.has(key);
      seen.add(key);
      return [
        fmtDate(l.date),
        l.clientVoucherNo,
        l.item,
        l.process,
        first && l.ordered !== null ? String(l.ordered) : "",
        l.deliveryNo,
        String(l.quantity),
      ];
    });
  }

  /** Per-process subtotals (Finishing first, Return last) and grand total. */
  function buildTotals(clientLines: Line[]): { subtotals: [string, number][]; grand: number } {
    const totals = new Map<string, number>();
    for (const l of clientLines) totals.set(l.process, (totals.get(l.process) ?? 0) + l.quantity);
    const subtotals = [...totals.entries()].sort(
      (a, b) => processRank(a[0]) - processRank(b[0]),
    );
    return { subtotals, grand: subtotals.reduce((s, [, n]) => s + n, 0) };
  }

  const fileBase = (client: string) =>
    `msulaim-${client.replace(/\s+/g, "-")}-${from || "start"}_to_${to || "today"}`;

  function download(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportClientCsv(client: string, clientLines: Line[]) {
    const { subtotals, grand } = buildTotals(clientLines);
    const rows = [
      [`Client: ${client}`],
      [`Period: ${from ? fmtDate(from) : "start"} to ${to ? fmtDate(to) : "today"}`],
      [""],
      HEADER,
      ...buildRows(clientLines),
      [""],
      ["", "", "", "", "", "Subtotal", ""],
      ...subtotals.map(([p, q]) => ["", "", "", "", "", p, String(q)]),
      ["", "", "", "", "", "Grand Total", String(grand)],
    ];
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    download(new Blob([csv], { type: "text/csv" }), `${fileBase(client)}.csv`);
  }

  async function exportClientPdf(client: string, clientLines: Line[]) {
    const { jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const w = doc.internal.pageSize.getWidth();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("M Sulaim", w / 2, 50, { align: "center" });
    doc.setFontSize(13);
    doc.text("Delivery Statement", w / 2, 72, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(`Client: ${client}`, 40, 100);
    const { subtotals, grand } = buildTotals(clientLines);
    const plain = { fillColor: [255, 255, 255] as [number, number, number], lineWidth: 0 };
    autoTable(doc, {
      startY: 112,
      head: [HEADER],
      body: buildRows(clientLines),
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
        ...subtotals.map(([p, q]) => [
          { content: p, styles: { halign: "left" as const } },
          String(q),
        ]),
        [
          { content: "Grand Total", styles: { fontStyle: "bold", halign: "left" } },
          { content: String(grand), styles: { fontStyle: "bold" } },
        ],
      ],
      didDrawCell: (data) => {
        if (data.section === "body" && data.row.index === subtotals.length + 1) {
          const { x, y: cy, width, height } = data.cell;
          doc.setDrawColor(20);
          doc.setLineWidth(0.8);
          doc.line(x, cy, x + width, cy);
          doc.line(x, cy + height, x + width, cy + height);
          doc.line(x, cy + height + 2.5, x + width, cy + height + 2.5);
        }
      },
    });
    download(doc.output("blob"), `${fileBase(client)}.pdf`);
  }

  const th =
    "text-left px-2 py-2 text-[10px] uppercase tracking-[0.08em] text-inkmuted font-semibold whitespace-nowrap";
  const td = "px-2 py-2 whitespace-nowrap";
  const dateInput =
    "glass rounded-xl px-3 py-1.5 text-[12px] font-semibold text-ink outline-none";

  return (
    <AppShell title="Statement" subtitle="Delivered per client">
      <div className="frost rounded-2xl p-3 flex items-center gap-2 flex-wrap">
        <label className="text-[11px] font-semibold text-inkmuted flex items-center gap-1.5">
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={dateInput}
          />
        </label>
        <label className="text-[11px] font-semibold text-inkmuted flex items-center gap-1.5">
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className={dateInput}
          />
        </label>
      </div>

      <div className="space-y-2.5">
        {byClient.map(([client, clientLines]) => (
          <article
            key={client}
            className="frost rounded-2xl p-4 shadow-[0_14px_30px_-18px_#0e224440]"
          >
            <div className="flex items-center justify-between mb-2 gap-2">
              <span className="font-display text-[14px] font-semibold">{client}</span>
              <span className="flex items-center gap-2">
                <span className="text-[11px] text-tealdeep font-semibold">
                  {clientLines
                    .filter((l) => isBaseProcess(l.process))
                    .reduce((s, l) => s + l.quantity, 0)}{" "}
                  of{" "}
                  {[
                    ...new Set(clientLines.map((l) => l.clientVoucherNo.trim().toLowerCase())),
                  ].reduce((s, v) => s + (voucherInfo.get(v)?.ordered ?? 0), 0)}{" "}
                  delivered
                </span>
                <button
                  onClick={() => exportClientPdf(client, clientLines)}
                  className="px-2.5 py-1 rounded-full bg-brand text-primary-foreground text-[10px] font-semibold"
                >
                  Export PDF
                </button>
                <button
                  onClick={() => exportClientCsv(client, clientLines)}
                  className="px-2.5 py-1 rounded-full glass text-[10px] font-semibold text-brand"
                >
                  Export CSV
                </button>
              </span>
            </div>
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-frostline/50">
                    {HEADER.map((h, i) => (
                      <th key={h} className={i === 4 || i === 6 ? `${th} text-right` : th}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {buildRows(clientLines).map((r, i) => (
                    <tr key={i} className="border-b border-frostline/30 last:border-0">
                      <td className={td}>{r[0]}</td>
                      <td className={`${td} font-mono`}>{r[1]}</td>
                      <td className={td}>{r[2]}</td>
                      <td className={td}>{r[3]}</td>
                      <td className={`${td} text-right text-inkmuted`}>{r[4]}</td>
                      <td className={`${td} font-mono text-brand`}>{r[5]}</td>
                      <td className={`${td} text-right font-semibold`}>{r[6]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        ))}
        {byClient.length === 0 && (
          <div className="frost rounded-2xl p-5 text-center text-[13px] text-inkmuted">
            Nothing delivered in this date range.
          </div>
        )}
      </div>
    </AppShell>
  );
}
