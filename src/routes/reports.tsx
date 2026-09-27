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

type Line = { client: string; item: string; process: string; quantity: number; vouchers: string[] };

function Reports() {
  const { data: board } = useSuspenseQuery(boardQuery);

  const months = useMemo(() => {
    const set = new Set(board.deliveryVouchers.map((d) => monthKey(d.date)));
    return [...set].filter((m) => m !== "unknown").sort().reverse();
  }, [board]);

  const [month, setMonth] = useState(() => months[0] ?? monthKey(new Date().toISOString()));

  const lines = useMemo<Line[]>(() => {
    const map = new Map<string, Line>();
    for (const d of board.deliveryVouchers) {
      if (monthKey(d.date) !== month) continue;
      const key = `${d.clientName}||${d.item}||${d.process}`;
      const line = map.get(key) ?? {
        client: d.clientName || "—",
        item: d.item || "—",
        process: d.process,
        quantity: 0,
        vouchers: [],
      };
      line.quantity += num(d.quantity);
      line.vouchers.push(d.deliveryNo);
      map.set(key, line);
    }
    return [...map.values()].sort((a, b) => a.client.localeCompare(b.client));
  }, [board, month]);

  const byClient = useMemo(() => {
    const map = new Map<string, Line[]>();
    for (const l of lines) map.set(l.client, [...(map.get(l.client) ?? []), l]);
    return [...map.entries()];
  }, [lines]);

  function exportCsv() {
    const rows = [
      ["Client", "Item", "Process", "Quantity delivered", "Delivery vouchers"],
      ...lines.map((l) => [l.client, l.item, l.process, String(l.quantity), l.vouchers.join(" ")]),
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
            <div className="flex items-center justify-between mb-3">
              <span className="font-display text-[14px] font-semibold">{client}</span>
              <span className="text-[11px] text-tealdeep font-semibold">
                {clientLines.reduce((s, l) => s + l.quantity, 0)} delivered
              </span>
            </div>
            <div className="space-y-2">
              {clientLines.map((l) => (
                <div key={`${l.item}-${l.process}`} className="text-[12px]">
                  <div className="flex justify-between">
                    <span className="text-inkmuted truncate">
                      {l.item}
                      {l.process ? ` · ${l.process}` : ""}
                    </span>
                    <span className="font-semibold">{l.quantity}</span>
                  </div>
                  <div className="text-[10px] text-inkmuted font-mono truncate">
                    {l.vouchers.join(", ")}
                  </div>
                </div>
              ))}
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
