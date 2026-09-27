import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { VoucherCard } from "@/components/VoucherCard";
import { boardQuery } from "@/lib/voucher-queries";
import { statusOf, type Status } from "@/lib/voucher-utils";

export const Route = createFileRoute("/vouchers")({
  head: () => ({
    meta: [
      { title: "Client vouchers — VoucherLink" },
      {
        name: "description",
        content: "Search every client voucher and see which delivery vouchers are linked to it.",
      },
      { property: "og:title", content: "Client vouchers — VoucherLink" },
      {
        property: "og:description",
        content: "Search client vouchers and their linked delivery vouchers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(boardQuery),
  component: Vouchers,
  errorComponent: ({ error }: { error: Error }) => (
    <AppShell title="Client vouchers">
      <div className="frost rounded-2xl p-4 text-[13px] text-inkmuted">{error.message}</div>
    </AppShell>
  ),
  notFoundComponent: () => <AppShell title="Not found">Nothing here.</AppShell>,
});

const filters: { key: Status | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "partial", label: "Partial" },
  { key: "linked", label: "Linked" },
];

function Vouchers() {
  const { data: board } = useSuspenseQuery(boardQuery);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Status | "all">("all");

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return board.clientVouchers.filter((v) => {
      if (filter !== "all" && statusOf(board, v) !== filter) return false;
      if (!needle) return true;
      return [v.voucherNo, v.clientName, v.item, v.process, v.date]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [board, q, filter]);

  return (
    <AppShell title="Client vouchers" subtitle={`${board.clientVouchers.length} received`}>
      <div className="flex items-center gap-2 px-3.5 h-11 rounded-2xl frost shadow-[0_10px_24px_-14px_#0e224433]">
        <span className="text-inkmuted text-[13px]">●</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search vouchers, clients, items…"
          className="w-full bg-transparent text-[13px] outline-none placeholder:text-inkmuted"
        />
      </div>

      <div className="flex gap-2">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-semibold ${
              filter === f.key ? "bg-brand text-primary-foreground" : "glass text-inkmuted"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-2.5">
        {rows.map((v) => (
          <VoucherCard key={v.voucherNo} board={board} voucher={v} />
        ))}
        {rows.length === 0 && (
          <div className="frost rounded-2xl p-5 text-center text-[13px] text-inkmuted">
            No vouchers match.
          </div>
        )}
      </div>
    </AppShell>
  );
}
