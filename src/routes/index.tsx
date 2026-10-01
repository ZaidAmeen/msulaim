import { createFileRoute, Link, type ErrorComponentProps } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { VoucherCard } from "@/components/VoucherCard";
import { boardQuery } from "@/lib/voucher-queries";
import { statusOf } from "@/lib/voucher-utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VoucherLink — Client & delivery voucher board" },
      {
        name: "description",
        content:
          "Track client vouchers and the delivery vouchers issued against them, live from Google Sheets.",
      },
      { property: "og:title", content: "VoucherLink — Client & delivery voucher board" },
      {
        property: "og:description",
        content: "Daily board of client vouchers and their linked delivery vouchers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(boardQuery),
  component: Board,
  errorComponent: SheetError,
  notFoundComponent: () => <AppShell title="Not found">Nothing here.</AppShell>,
});

function SheetError({ error }: ErrorComponentProps) {
  return (
    <AppShell title="Board">
      <div className="frost rounded-2xl p-4 text-[13px] text-inkmuted">
        Couldn&apos;t load your sheet right now. {(error as Error).message}
      </div>
    </AppShell>
  );
}

function Board() {
  const { data: board } = useSuspenseQuery(boardQuery);
  const received = board.clientVouchers.length;
  const issued = board.deliveryVouchers.length;
  const pending = board.clientVouchers.filter((v) => statusOf(board, v) === "pending").length;
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <AppShell title="Today" subtitle={`Synced · ${received + issued} rows`}>
      <div className="-mt-2 text-[11px] text-inkmuted font-medium">{today}</div>

      <div className="grid grid-cols-3 gap-2.5">
        <Stat label="Received" value={received} note="client vouchers" tone="text-branddeep" />
        <Stat label="Issued" value={issued} note="delivery vouchers" tone="text-tealdeep" />
        <Stat label="Pending" value={pending} note="needs link" tone="text-warn" />
      </div>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-[13px] font-semibold uppercase tracking-[0.14em] text-inkmuted">
            Recent links
          </h2>
          <Link to="/vouchers" className="text-[11px] text-brand font-semibold">
            View all
          </Link>
        </div>

        <div className="space-y-2.5">
          {board.clientVouchers.slice(0, 6).map((v) => (
            <VoucherCard key={v.voucherNo} board={board} voucher={v} />
          ))}
          {received === 0 && (
            <div className="frost rounded-2xl p-5 text-center text-[13px] text-inkmuted">
              No vouchers yet. Tap + to add your first client voucher.
            </div>
          )}
        </div>
      </section>
    </AppShell>
  );
}

function Stat({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: number;
  note: string;
  tone: string;
}) {
  return (
    <div className="glass rounded-2xl px-3 py-3">
      <div className="text-[10px] uppercase tracking-[0.12em] text-inkmuted font-semibold">
        {label}
      </div>
      <div className="font-display text-[22px] font-bold leading-tight">{value}</div>
      <div className={`text-[10px] font-semibold ${tone}`}>{note}</div>
    </div>
  );
}
