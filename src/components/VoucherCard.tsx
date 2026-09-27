import type { Board, ClientVoucher } from "@/lib/vouchers.functions";
import { deliveriesFor, statusOf } from "@/lib/voucher-utils";

const styles = {
  linked: { chip: "bg-teal/15 text-tealdeep", dot: "bg-teal", label: "Linked" },
  partial: { chip: "bg-warn/15 text-warn", dot: "bg-warn", label: "Partial" },
  pending: { chip: "bg-warn/15 text-warn", dot: "bg-warn", label: "Pending" },
} as const;

export function VoucherCard({ board, voucher }: { board: Board; voucher: ClientVoucher }) {
  const status = statusOf(board, voucher);
  const s = styles[status];
  const linked = deliveriesFor(board, voucher.voucherNo);

  return (
    <article className="frost rounded-2xl p-4 shadow-[0_14px_30px_-18px_#0e224440]">
      <div className="flex items-center justify-between mb-3">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${s.chip}`}
        >
          <span className={`size-1.5 rounded-full ${s.dot}`} />
          {s.label}
        </span>
        <span className="text-[11px] text-inkmuted">{voucher.date}</span>
      </div>

      <div className="flex items-center gap-2 text-[13px] font-semibold">
        <span className="px-2 py-0.5 rounded-md bg-frostline/60 text-branddeep font-mono">
          {voucher.voucherNo}
        </span>
        <span className="text-inkmuted font-normal text-[12px] truncate">{voucher.clientName}</span>
        <span className="ml-auto text-inkmuted text-[12px]">⇄</span>
        <span
          className={`px-2 py-0.5 rounded-md font-mono ${
            linked.length ? "bg-brand/12 text-brand" : "bg-warnsoft text-warn"
          }`}
        >
          {linked.length ? linked.map((d) => d.deliveryNo).join(", ") : "—"}
        </span>
      </div>

      <div className="h-px bg-frostline/40 my-3" />

      <div className="flex items-center justify-between text-[12px]">
        <span className="text-inkmuted truncate">
          {voucher.item}
          {voucher.process ? ` · ${voucher.process}` : ""}
        </span>
        <span className="font-semibold text-ink">Qty {voucher.quantity || "—"}</span>
      </div>
    </article>
  );
}
