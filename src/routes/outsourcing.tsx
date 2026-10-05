import { createFileRoute, type ErrorComponentProps } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { StatementPreview } from "@/components/StatementPreview";
import { HistoryList } from "@/components/HistoryList";
import { boardQuery } from "@/lib/voucher-queries";
import { addOutsourcing, outsourceKey } from "@/lib/vouchers.functions";
import { CLIENTS, OUTSOURCE_PROCESSES, withExisting } from "@/lib/options";
import { fmtDate, processRank } from "@/lib/date-format";
import { num } from "@/lib/voucher-utils";
import type { Statement } from "@/lib/statement";

export const Route = createFileRoute("/outsourcing")({
  head: () => ({
    meta: [
      { title: "Outsourcing — M Sulaim" },
      { name: "description", content: "Record work sent to outsourcing partners and get partner statements." },
      { property: "og:title", content: "Outsourcing — M Sulaim" },
      { property: "og:description", content: "Outsourced work per partner with statements." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(boardQuery),
  component: Outsourcing,
  errorComponent: ({ error }: ErrorComponentProps) => (
    <AppShell title="Outsourcing">
      <div className="frost rounded-2xl p-4 text-[13px] text-inkmuted">{(error as Error).message}</div>
    </AppShell>
  ),
});

const ADD = "__add__";
const today = () => new Date().toISOString().slice(0, 10);
const key = (d: string) => {
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? "" : t.toISOString().slice(0, 10);
};

function Outsourcing() {
  const { data: board } = useSuspenseQuery(boardQuery);
  const qc = useQueryClient();
  const save = useServerFn(addOutsourcing);
  const partners = withExisting(board.options.partners, board.outsourcing.map((o) => o.partner));
  const processes = withExisting(
    [...OUTSOURCE_PROCESSES, ...board.options.processes],
    board.outsourcing.map((o) => o.process),
  );
  const parties = withExisting(CLIENTS, board.clientVouchers.map((c) => c.clientName));
  const [f, setF] = useState({ date: today(), partner: "", newPartner: "", party: "", process: "", newProcess: "", quantity: "" });
  const partner = f.partner === ADD ? f.newPartner.trim() : f.partner;
  const process = f.process === ADD ? f.newProcess.trim() : f.process;
  const ok = f.date && partner && f.party && process && Number(f.quantity) > 0;

  const m = useMutation({
    mutationFn: () =>
      save({
        data: { date: f.date, partner, party: f.party, process, quantity: f.quantity, newPartner: f.partner === ADD, newProcess: f.process === ADD },
      }),
    onSuccess: () => {
      toast.success("Outsourced work saved.");
      setF({ ...f, quantity: "", partner, process, newPartner: "", newProcess: "" });
      qc.invalidateQueries({ queryKey: ["board"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const [from, setFrom] = useState(() => today().slice(0, 8) + "01");
  const [to, setTo] = useState(today);
  const [preview, setPreview] = useState<Statement | null>(null);
  const byPartner = useMemo(() => {
    const map = new Map<string, typeof board.outsourcing>();
    for (const o of board.outsourcing) {
      const k = key(o.date);
      if (k && ((from && k < from) || (to && k > to))) continue;
      map.set(o.partner, [...(map.get(o.partner) ?? []), o]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [board, from, to]);

  function toStatement(name: string, rows: typeof board.outsourcing): Statement {
    const sorted = [...rows].sort((a, b) => key(a.date).localeCompare(key(b.date)) || processRank(a.process) - processRank(b.process));
    const totals = new Map<string, number>();
    for (const r of sorted) totals.set(r.process, (totals.get(r.process) ?? 0) + num(r.quantity));
    const subtotals = [...totals.entries()];
    return {
      kind: "partner", name, from, to, title: "Outsourcing Statement",
      header: ["Date", "Party", "Process", "Quantity"],
      rows: sorted.map((r) => [fmtDate(r.date), r.party, r.process, r.quantity]),
      numericCols: [3], subtotals, grand: subtotals.reduce((s, [, n]) => s + n, 0),
      keys: sorted.map(outsourceKey),
    };
  }

  const field = "glass rounded-xl px-3 h-10 text-[13px] w-full outline-none";
  const lbl = "text-[11px] font-semibold text-inkmuted space-y-1 block";

  return (
    <AppShell title="Outsourcing" subtitle="Work sent to partners">
      <div className="frost rounded-2xl p-4 space-y-3">
        <label className={lbl}>Date<input type="date" className={field} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
        <label className={lbl}>Partner name
          <select className={field} value={f.partner} onChange={(e) => setF({ ...f, partner: e.target.value })}>
            <option value="">Choose partner</option>
            {partners.map((p) => <option key={p}>{p}</option>)}
            <option value={ADD}>+ Add new partner</option>
          </select>
        </label>
        {f.partner === ADD && <input className={field} placeholder="New partner name" value={f.newPartner} onChange={(e) => setF({ ...f, newPartner: e.target.value })} />}
        <label className={lbl}>Party name
          <select className={field} value={f.party} onChange={(e) => setF({ ...f, party: e.target.value })}>
            <option value="">Choose party</option>
            {parties.map((p) => <option key={p}>{p}</option>)}
          </select>
        </label>
        <label className={lbl}>Process
          <select className={field} value={f.process} onChange={(e) => setF({ ...f, process: e.target.value })}>
            <option value="">Choose process</option>
            {processes.map((p) => <option key={p}>{p}</option>)}
            <option value={ADD}>+ Add new process</option>
          </select>
        </label>
        {f.process === ADD && <input className={field} placeholder="New process name" value={f.newProcess} onChange={(e) => setF({ ...f, newProcess: e.target.value })} />}
        <label className={lbl}>Quantity<input inputMode="numeric" pattern="[0-9]*" className={field} value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value.replace(/\D/g, "") })} /></label>
        <button disabled={!ok || m.isPending} onClick={() => m.mutate()} className="w-full h-11 rounded-2xl bg-brand text-primary-foreground font-semibold text-[13px] disabled:opacity-50">
          {m.isPending ? "Saving…" : "Save"}
        </button>
      </div>

      <div className="frost rounded-2xl p-3 flex items-center gap-2 flex-wrap text-[11px] font-semibold text-inkmuted">
        From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="glass rounded-xl px-3 py-1.5 text-ink" />
        To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="glass rounded-xl px-3 py-1.5 text-ink" />
      </div>
      <div className="space-y-2.5">
        {byPartner.map(([name, rows]) => (
          <article key={name} className="frost rounded-2xl p-4 flex items-center justify-between">
            <div>
              <div className="font-display text-[14px] font-semibold">{name}</div>
              <div className="text-[11px] text-inkmuted">{rows.length} entries · {rows.reduce((s, r) => s + num(r.quantity), 0)} pcs</div>
            </div>
            <button onClick={() => setPreview(toStatement(name, rows))} className="px-3 py-1.5 rounded-full bg-brand text-primary-foreground text-[11px] font-semibold">Preview</button>
          </article>
        ))}
        {byPartner.length === 0 && <div className="frost rounded-2xl p-5 text-center text-[13px] text-inkmuted">No outsourced work in this date range.</div>}
      </div>
      <section>
        <h2 className="font-display text-[13px] font-semibold uppercase tracking-[0.14em] text-inkmuted mb-3">Past partner reports</h2>
        <HistoryList items={board.history.filter((h) => h.type === "Partner")} empty="No partner reports finalized yet." />
      </section>
      <StatementPreview statement={preview} onClose={() => setPreview(null)} />
    </AppShell>
  );
}
