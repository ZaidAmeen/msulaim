import type { StatementRecord } from "@/lib/vouchers.functions";
import { fmtDate } from "@/lib/date-format";

export function HistoryList({ items, empty }: { items: StatementRecord[]; empty: string }) {
  return (
    <div className="space-y-2.5">
      {items.map((h) => {
        const partner = h.type === "Partner";
        const transport = h.type === "Transport";
        return (
          <article key={h.id} className="frost rounded-2xl p-4 flex items-center justify-between gap-2">
            <div className="text-[12px] min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-display text-[14px] font-semibold truncate">{h.name}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    transport ? "bg-warn/15 text-warn" : partner ? "bg-teal/15 text-tealdeep" : "bg-brand/12 text-branddeep"
                  }`}
                >
                  {transport ? "Transport" : partner ? "Partner Report" : "Client Statement"}
                </span>
              </div>
              <div className="text-inkmuted">
                {h.from ? fmtDate(h.from) : "start"} to {h.to ? fmtDate(h.to) : "today"} · {h.rows} rows · total {h.total}
              </div>
            </div>
            <a
              href={h.driveUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-full bg-brand text-primary-foreground text-[11px] font-semibold whitespace-nowrap"
            >
              Open in Drive
            </a>
          </article>
        );
      })}
      {items.length === 0 && (
        <div className="frost rounded-2xl p-5 text-center text-[13px] text-inkmuted">{empty}</div>
      )}
    </div>
  );
}
