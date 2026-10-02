import { createFileRoute, type ErrorComponentProps } from "@tanstack/react-router";
import { fmtDate } from "@/lib/date-format";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { boardQuery } from "@/lib/voucher-queries";

export const Route = createFileRoute("/deliveries")({
  head: () => ({
    meta: [
      { title: "Delivery vouchers — VoucherLink" },
      {
        name: "description",
        content: "Every delivery voucher you issued, with the client voucher it belongs to.",
      },
      { property: "og:title", content: "Delivery vouchers — VoucherLink" },
      {
        property: "og:description",
        content: "Delivery vouchers issued, each linked to its client voucher.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(boardQuery),
  component: Deliveries,
  errorComponent: ({ error }: ErrorComponentProps) => (
    <AppShell title="Delivery vouchers">
      <div className="frost rounded-2xl p-4 text-[13px] text-inkmuted">{(error as Error).message}</div>
    </AppShell>
  ),
  notFoundComponent: () => <AppShell title="Not found">Nothing here.</AppShell>,
});

function Deliveries() {
  const { data: board } = useSuspenseQuery(boardQuery);
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const rows = board.deliveryVouchers.filter((d) =>
    needle
      ? [d.deliveryNo, d.clientVoucherNo, d.clientName, d.item, d.date]
          .join(" ")
          .toLowerCase()
          .includes(needle)
      : true,
  );

  return (
    <AppShell title="Delivery vouchers" subtitle={`${board.deliveryVouchers.length} issued`}>
      <div className="flex items-center gap-2 px-3.5 h-11 rounded-2xl frost shadow-[0_10px_24px_-14px_#0e224433]">
        <span className="text-inkmuted text-[13px]">●</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search delivery numbers…"
          className="w-full bg-transparent text-[13px] outline-none placeholder:text-inkmuted"
        />
      </div>

      <div className="space-y-2.5">
        {rows.map((d) => (
          <article
            key={`${d.deliveryNo}-${d.clientVoucherNo}`}
            className="frost rounded-2xl p-4 shadow-[0_14px_30px_-18px_#0e224440]"
          >
            <div className="flex items-center gap-2 text-[13px] font-semibold">
              <span className="px-2 py-0.5 rounded-md bg-brand/12 text-brand font-mono">
                {d.deliveryNo}
              </span>
              <span className="text-inkmuted text-[12px]">⇄</span>
              <span className="px-2 py-0.5 rounded-md bg-frostline/60 text-branddeep font-mono">
                {d.clientVoucherNo}
              </span>
              <span className="ml-auto text-[11px] text-inkmuted font-normal">{fmtDate(d.date)}</span>
            </div>
            <div className="h-px bg-frostline/40 my-3" />
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
              <span className="text-inkmuted">Client</span>
              <span className="font-semibold text-right truncate">{d.clientName || "—"}</span>
              <span className="text-inkmuted">Item</span>
              <span className="font-semibold text-right truncate">{d.item || "—"}</span>
              <span className="text-inkmuted">Process</span>
              <span className="font-semibold text-right truncate">{d.process || "—"}</span>
              <span className="text-inkmuted">Qty delivered</span>
              <span className="font-semibold text-right">{d.quantity || "—"}</span>
              {d.notes && (
                <>
                  <span className="text-inkmuted">Notes</span>
                  <span className="text-right truncate">{d.notes}</span>
                </>
              )}
            </div>
          </article>
        ))}
        {rows.length === 0 && (
          <div className="frost rounded-2xl p-5 text-center text-[13px] text-inkmuted">
            No delivery vouchers yet.
          </div>
        )}
      </div>
    </AppShell>
  );
}
