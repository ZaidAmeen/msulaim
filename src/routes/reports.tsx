import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { boardQuery } from "@/lib/voucher-queries";
import { monthKey, monthLabel, num } from "@/lib/voucher-utils";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Month-end report — VoucherLink" },
      {
        name: "description",
        content: "Month-end delivery totals per client, built from your voucher sheet.",
      },
      { property: "og:title", content: "Month-end report — VoucherLink" },
      {
        property: "og:description",
        content: "Delivered items per client for any month, exportable as CSV.",
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

function Reports() {
  const { data: board } = useSuspenseQuery(boardQuery);

  const months = useMemo(() => {
    const set = new Set(board.deliveryVouchers.map((d) => monthKey(d.date)));
    return [...set].filter((m) => m !== "unknown").sort().reverse();
  }, [board]);

  const [month, setMonth] = useState(() => months[0] ?? monthKey(new Date().toISOString()));

  const orderedByVoucher = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of board.clientVouchers) {
      map.set(v.voucherNo.trim().toLowerCase(), num(v.quantity));
    }
    return map;
  }, [board]);

  const lines = useMemo<Line[]>(
    () =>
      board.deliveryVouchers
        .filter((d) => monthKey(d.date) === month)
        .map((d) => ({
          date: d.date,
          deliveryNo: d.deliveryNo,
          clientVoucherNo: d.clientVoucherNo,
          client: d.clientName || "—",
          item: d.item || "—",
          process: d.process || "—",
          ordered: orderedByVoucher.get(d.clientVoucherNo.trim().toLowerCase()) ?? null,
          quantity: num(d.quantity),
        }))
        .sort(
          (a, b) =>
            a.client.localeCompare(b.client) ||
            a.date.localeCompare(b.date) ||
            a.clientVoucherNo.localeCompare(b.clientVoucherNo),
        ),
    [board, month, orderedByVoucher],
  );

  const byClient = useMemo(() => {
    const map = new Map<string, Line[]>();
    for (const l of lines) map.set(l.client, [...(map.get(l.client) ?? []), l]);
    return [...map.entries()];
  }, [lines]);

  function exportCsv() {
    const rows = [
      [
        "Client",
        "Date",
        "Delivery voucher",
        "Client voucher",
        "Item",
        "Process",
        "Ordered quantity",
        "Delivered quantity",
      ],
      ...lines.map((l) => [
        l.client,
        l.date,
        l.deliveryNo,
        l.clientVoucherNo,
        l.item,
        l.process,
        l.ordered === null ? "" : String(l.ordered),
        String(l.quantity),
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `voucherlink-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const th = "text-left px-2 py-2 text-[10px] uppercase tracking-[0.08em] text-inkmuted font-semibold whitespace-nowrap";
  const td = "px-2 py-2 whitespace-nowrap";

  return (
    <AppShell title="Month end" subtitle="Delivered per client">
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {(months.length ? months : [month]).map((m) => (
          <button
            key={m}
            onClick={() => setMonth(m)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold ${
              month === m ? "bg-brand text-primary-foreground" : "glass text-inkmuted"
            }`}
          >
            {monthLabel(m)}
          </button>
        ))}
      </div>

      <div className="space-y-2.5">
        {byClient.map(([client, clientLines]) => (
          <article key={client} className="frost rounded-2xl p-4 shadow-[0_14px_30px_-18px_#0e224440]">
            <div className="flex items-center justify-between mb-2">
              <span className="font-display text-[14px] font-semibold">{client}</span>
              <span className="text-[11px] text-tealdeep font-semibold">
                {clientLines.reduce((s, l) => s + l.quantity, 0)} delivered
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
                    <th className={`${th} text-right`}>Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {clientLines.map((l, i) => (
                    <tr key={`${l.deliveryNo}-${i}`} className="border-b border-frostline/30 last:border-0">
                      <td className={td}>{l.date}</td>
                      <td className={`${td} font-mono text-brand`}>{l.deliveryNo}</td>
                      <td className={`${td} font-mono`}>{l.clientVoucherNo}</td>
                      <td className={td}>{l.item}</td>
                      <td className={td}>{l.process}</td>
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
            Nothing delivered in this month yet.
          </div>
        )}
      </div>

      <button
        onClick={exportCsv}
        className="w-full py-3 rounded-2xl bg-brand text-primary-foreground font-display font-semibold shadow-[0_10px_24px_-10px_var(--brand)]"
      >
        Export CSV
      </button>
    </AppShell>
  );
}
