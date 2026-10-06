import { createFileRoute, type ErrorComponentProps } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { StatementPreview } from "@/components/StatementPreview";
import { HistoryList } from "@/components/HistoryList";
import { boardQuery } from "@/lib/voucher-queries";
import { addTransport, transportKey, type TransportEntry } from "@/lib/vouchers.functions";
import { CLIENTS, withExisting } from "@/lib/options";
import { fmtDate } from "@/lib/date-format";
import { num } from "@/lib/voucher-utils";
import type { Statement } from "@/lib/statement";

export const Route = createFileRoute("/transport")({
  head: () => ({
    meta: [
      { title: "Transport — M Sulaim" },
      { name: "description", content: "Track boxes, bags and covers moved by transport partners." },
      { property: "og:title", content: "Transport — M Sulaim" },
      { property: "og:description", content: "Inward and outward packages per transport partner with statements." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(boardQuery),
  component: Transport,
  errorComponent: ({ error }: ErrorComponentProps) => (
    <AppShell title="Transport">
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
const digits = (v: string) => v.replace(/\D/g, "");

function pkgs(r: TransportEntry) {
  return [
    num(r.boxes) && `${num(r.boxes)} Boxes`,
    num(r.bags) && `${num(r.bags)} Bags`,
    num(r.covers) && `${num(r.covers)} Covers`,
  ]
    .filter(Boolean)
    .join(", ");
}

function Transport() {
  const { data: board } = useSuspenseQuery(boardQuery);
  const qc = useQueryClient();
  const save = useServerFn(addTransport);
  const partners = withExisting(board.options.transporters, board.transport.map((t) => t.partner));
  const clients = withExisting(CLIENTS, board.clientVouchers.map((c) => c.clientName));
  const blank = { date: today(), partner: "", newPartner: "", client: "", direction: "Outwards" as "Inwards" | "Outwards", boxes: "", bags: "", covers: "", notes: "" };
  const [f, setF] = useState(blank);
  const partner = f.partner === ADD ? f.newPartner.trim() : f.partner;
  const total = num(f.boxes) + num(f.bags) + num(f.covers);
  const ok = f.date && partner && f.client && total > 0;

  const m = useMutation({
    mutationFn: () =>
      save({ data: { date: f.date, partner, client: f.client, direction: f.direction, boxes: f.boxes, bags: f.bags, covers: f.covers, notes: f.notes, newPartner: f.partner === ADD } }),
    onSuccess: () => {
      toast.success("Transport entry saved.");
      setF({ ...blank, date: f.date, partner, client: f.client, direction: f.direction });
      qc.invalidateQueries({ queryKey: ["board"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const [from, setFrom] = useState(() => key(new Date(Date.now() - 6 * 864e5).toISOString()));
  const [to, setTo] = useState(today);
  const [preview, setPreview] = useState<Statement | null>(null);
  const byPartner = useMemo(() => {
    const map = new Map<string, TransportEntry[]>();
    for (const t of board.transport) {
      const k = key(t.date);
      if (k && ((from && k < from) || (to && k > to))) continue;
      map.set(t.partner, [...(map.get(t.partner) ?? []), t]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [board, from, to]);

  function toStatement(name: string, rows: TransportEntry[]): Statement {
    const sorted = [...rows].sort((a, b) => key(a.date).localeCompare(key(b.date)));
    const tot = (dir: string, f: "boxes" | "bags" | "covers") =>
      sorted.filter((r) => r.direction === dir).reduce((s, r) => s + num(r[f]), 0);
    const subtotals: [string, number][] = [];
    for (const dir of ["Inwards", "Outwards"])
      for (const [f, l] of [["boxes", "Boxes"], ["bags", "Bags"], ["covers", "Covers"]] as const) {
        const n = tot(dir, f);
        if (n) subtotals.push([`${dir} ${l}`, n]);
      }
    return {
      kind: "transport", name, from, to, title: "Transport Statement",
      header: ["Date", "Client", "Direction", "Boxes", "Bags", "Covers"],
      rows: sorted.map((r) => [fmtDate(r.date), r.client, r.direction, r.boxes || "0", r.bags || "0", r.covers || "0"]),
      numericCols: [3, 4, 5], subtotals, grand: subtotals.reduce((s, [, n]) => s + n, 0),
      keys: sorted.map(transportKey),
    };
  }

  const field = "glass rounded-xl px-3 h-10 text-[13px] w-full outline-none";
  const lbl = "text-[11px] font-semibold text-inkmuted space-y-1 block";

  return (
    <AppShell title="Transport" subtitle="Packages moved by partners">
      <div className="frost rounded-2xl p-4 space-y-3">
        <label className={lbl}>Date<input type="date" className={field} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
        <label className={lbl}>Transport partner
          <select className={field} value={f.partner} onChange={(e) => setF({ ...f, partner: e.target.value })}>
            <option value="">Choose partner</option>
            {partners.map((p) => <option key={p}>{p}</option>)}
            <option value={ADD}>+ Add new partner</option>
          </select>
        </label>
        {f.partner === ADD && <input className={field} placeholder="New partner name" value={f.newPartner} onChange={(e) => setF({ ...f, newPartner: e.target.value })} />}
        <label className={lbl}>Client
          <select className={field} value={f.client} onChange={(e) => setF({ ...f, client: e.target.value })}>
            <option value="">Choose client</option>
            {clients.map((p) => <option key={p}>{p}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          {(["Inwards", "Outwards"] as const).map((d) => (
            <button key={d} type="button" onClick={() => setF({ ...f, direction: d })}
              className={`h-10 rounded-xl text-[12px] font-semibold ${f.direction === d ? "bg-brand text-primary-foreground" : "glass text-inkmuted"}`}>
              {d === "Inwards" ? "↓ Inwards" : "↑ Outwards"}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(["boxes", "bags", "covers"] as const).map((k) => (
            <label key={k} className={lbl}>{k.charAt(0).toUpperCase() + k.slice(1)}
              <input inputMode="numeric" placeholder="0" className={field} value={f[k]} onChange={(e) => setF({ ...f, [k]: digits(e.target.value) })} />
            </label>
          ))}
        </div>
        <label className={lbl}>Notes (optional)<input className={field} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>
        <button disabled={!ok || m.isPending} onClick={() => m.mutate()} className="w-full h-11 rounded-2xl bg-brand text-primary-foreground font-semibold text-[13px] disabled:opacity-50">
          {m.isPending ? "Saving…" : "Save"}
        </button>
      </div>

      <div className="frost rounded-2xl p-3 flex items-center gap-2 flex-wrap text-[11px] font-semibold text-inkmuted">
        From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="glass rounded-xl px-3 py-1.5 text-ink" />
        To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="glass rounded-xl px-3 py-1.5 text-ink" />
      </div>
      <div className="space-y-2.5">
        {byPartner.map(([name, rows]) => {
          const inw = rows.filter((r) => r.direction === "Inwards");
          const out = rows.filter((r) => r.direction === "Outwards");
          const n = (rs: TransportEntry[]) => rs.reduce((s, r) => s + num(r.boxes) + num(r.bags) + num(r.covers), 0);
          return (
            <article key={name} className="frost rounded-2xl p-4 flex items-center justify-between gap-2">
              <div>
                <div className="font-display text-[14px] font-semibold">{name}</div>
                <div className="text-[11px] text-inkmuted">{rows.length} entries · ↓ {n(inw)} in · ↑ {n(out)} out</div>
                <div className="text-[10px] text-inkmuted">{rows.slice(0, 1).map(pkgs)}</div>
              </div>
              <button onClick={() => setPreview(toStatement(name, rows))} className="px-3 py-1.5 rounded-full bg-brand text-primary-foreground text-[11px] font-semibold">Preview</button>
            </article>
          );
        })}
        {byPartner.length === 0 && <div className="frost rounded-2xl p-5 text-center text-[13px] text-inkmuted">No transport entries in this date range.</div>}
      </div>
      <section>
        <h2 className="font-display text-[13px] font-semibold uppercase tracking-[0.14em] text-inkmuted mb-3">Past transport statements</h2>
        <HistoryList items={board.history.filter((h) => h.type === "Transport")} empty="No transport statements finalized yet." />
      </section>
      <StatementPreview statement={preview} onClose={() => setPreview(null)} />
    </AppShell>
  );
}
