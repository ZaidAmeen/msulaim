import { createFileRoute, type ErrorComponentProps } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { boardQuery } from "@/lib/voucher-queries";
import { useState } from "react";
import { HistoryList } from "@/components/HistoryList";

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

const tabs = [
  { key: "all", label: "All" },
  { key: "Client", label: "Client Statements" },
  { key: "Partner", label: "Partner Reports" },
] as const;

function History() {
  const { data: board } = useSuspenseQuery(boardQuery);
  const [tab, setTab] = useState<(typeof tabs)[number]["key"]>("all");
  const items = tab === "all" ? board.history : board.history.filter((h) => h.type === tab);
  return (
    <AppShell title="History" subtitle="Finalized statements">
      <div className="flex gap-2 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-semibold ${
              tab === t.key ? "bg-brand text-primary-foreground" : "glass text-inkmuted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <HistoryList items={items} empty="No finalized statements yet." />
    </AppShell>
  );
}
