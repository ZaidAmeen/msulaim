import { isBaseProcess } from "@/lib/options";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { boardQuery } from "@/lib/voucher-queries";
import { num } from "@/lib/voucher-utils";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Client statement — VoucherLink" },
      {
        name: "description",
        content: "Delivery statement per client for any date range, exportable as CSV.",
      },
      { property: "og:title", content: "Client statement — VoucherLink" },
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
  errorComponent: ({ error }: { error: Error }) => (
    <AppShell title="Reports">
      <div className="frost rounded-2xl p-4 text-[13px] text-inkmuted">{error.message}</div>
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
      map.set(v.voucherNo.trim().toLowerCase(), { date: v.date, ordered: num(v.quantity) });
    }
    return map;
  }, [board]);

  const lines = useMemo<Line[]>(
    () =>
      board.deliveryVouchers
        .map((d) => {
          const info = voucherInfo.get(d.clientVoucherNo.trim().toLowerCase());
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

  function exportClientCsv(client: string, clientLines: Line[]) {
    const header = [
      "Date",
      "Delivery voucher",
      "Client voucher",
      "Item",
      "Process",
      "Ordered quantity",
      "Delivered quantity",
    ];
    const dataRows = clientLines.map((l) => [
      l.date,
      l.deliveryNo,
      l.clientVoucherNo,
      l.item,
      l.process,
      l.ordered === null ? "" : String(l.ordered),
      String(l.quantity),
    ]);
    const totals = new Map<string, number>();
    for (const l of clientLines) {
      totals.set(l.process, (totals.get(l.process) ?? 0) + l.quantity);
    }
    const totalRows = [...totals.entries()].map(([process, qty]) => [
      "",
      "",
      "",
      "",
      `Total ${process}`,
      "",
      String(qty),
    ]);
    const fullTotal = [...totals.values()].reduce((s, n) => s + n, 0);
    const rows = [
      [`Client: ${client}`],
      [`Period: ${from || "start"} to ${to || "today"}`],
      [""],
      header,
      ...dataRows,
      [""],
      ...totalRows,
      ["", "", "", "", "Full Total", "", String(fullTotal)],
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `voucherlink-${client.replace(/\s+/g, "-")}-${from || "start"}_to_${to || "today"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
                    <th className={th}>Date</th>
                    <th className={th}>Delivery no.</th>
                    <th className={th}>Client voucher</th>
                    <th className={th}>Item</th>
                    <th className={th}>Process</th>
                    <th className={`${th} text-right`}>Ordered</th>
                    <th className={`${th} text-right`}>Delivered</th>
                  </tr>
                </thead>
                <tbody>
                  {clientLines.map((l, i) => (
                    <tr
                      key={`${l.deliveryNo}-${i}`}
                      className="border-b border-frostline/30 last:border-0"
                    >
                      <td className={td}>{l.date}</td>
                      <td className={`${td} font-mono text-brand`}>{l.deliveryNo}</td>
                      <td className={`${td} font-mono`}>{l.clientVoucherNo}</td>
                      <td className={td}>{l.item}</td>
                      <td className={td}>{l.process}</td>
                      <td className={`${td} text-right text-inkmuted`}>
                        {l.ordered === null ? "—" : l.ordered}
                      </td>
                      <td className={`${td} text-right font-semibold`}>{l.quantity}</td>
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
