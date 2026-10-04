import { createFileRoute, type ErrorComponentProps } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { boardQuery } from "@/lib/voucher-queries";
import { fmtDate } from "@/lib/date-format";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Statement history — M Sulaim" },
      { name: "description", content: "Finalized statements saved to Google Drive." },
      { property: "og:title", content: "Statement history — M Sulaim" },
      { property: "og:description", content: "Finalized client and partner statements with Drive links." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(boardQuery),
  component: History,
  errorComponent: ({ error }: ErrorComponentProps) => (
    <AppShell title="History">
      <div className="frost rounded-2xl p-4 text-[13px] text-inkmuted">{(error as Error).message}</div>
    </AppShell>
  ),
});

function History() {
  const { data: board } = useSuspenseQuery(boardQuery);
  return (
    <AppShell title="History" subtitle="Finalized statements">
      <div className="space-y-2.5">
        {board.history.map((h) => (
          <article key={h.id} className="frost rounded-2xl p-4 flex items-center justify-between gap-2">
            <div className="text-[12px]">
              <div className="font-display text-[14px] font-semibold">{h.name}</div>
              <div className="text-inkmuted">
                {h.type} · {h.from ? fmtDate(h.from) : "start"} to {h.to ? fmtDate(h.to) : "today"} · total {h.total}
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
        ))}
        {board.history.length === 0 && (
          <div className="frost rounded-2xl p-5 text-center text-[13px] text-inkmuted">
            No finalized statements yet.
          </div>
        )}
      </div>
    </AppShell>
  );
}
