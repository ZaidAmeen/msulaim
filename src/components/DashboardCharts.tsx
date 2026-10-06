import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Board } from "@/lib/vouchers.functions";
import { isBaseProcess } from "@/lib/options";
import { num } from "@/lib/voucher-utils";

const COLORS = ["var(--brand)", "var(--teal)", "var(--warn)", "var(--branddeep)", "var(--tealdeep)"];

function dayKey(d: string) {
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? "" : t.toISOString().slice(0, 10);
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="frost rounded-2xl p-4">
      <h3 className="font-display text-[12px] font-semibold uppercase tracking-[0.12em] text-inkmuted mb-2">{title}</h3>
      <div className="h-44">{children}</div>
    </div>
  );
}

const sum = (m: Map<string, number>, k: string, n: number) => m.set(k, (m.get(k) ?? 0) + n);
const toData = (m: Map<string, number>) => [...m.entries()].map(([name, value]) => ({ name, value }));
const axis = { fontSize: 10, fill: "var(--inkmuted)" };

export function DashboardCharts({ board }: { board: Board }) {
  // Last 14 days of physical sarees delivered
  const days: string[] = [];
  for (let i = 13; i >= 0; i--) days.push(new Date(Date.now() - i * 864e5).toISOString().slice(0, 10));
  const daily = new Map(days.map((d) => [d, 0]));
  const clients = new Map<string, number>();
  const processes = new Map<string, number>();
  for (const d of board.deliveryVouchers.filter((x) => !x.archived)) {
    const q = num(d.quantity);
    if (isBaseProcess(d.process)) {
      const k = dayKey(d.date);
      if (daily.has(k)) sum(daily, k, q);
      sum(clients, d.clientName || "Unknown", q);
    }
    sum(processes, d.process || "Finishing", q);
  }
  const partners = new Map<string, number>();
  for (const o of board.outsourcing) {
    sum(partners, o.partner, num(o.quantity));
    sum(processes, o.process, 0);
  }
  const tp = new Map<string, { name: string; Inwards: number; Outwards: number }>();
  for (const t of board.transport) {
    const e = tp.get(t.partner) ?? { name: t.partner, Inwards: 0, Outwards: 0 };
    const n = num(t.boxes) + num(t.bags) + num(t.covers);
    if (t.direction === "Inwards") e.Inwards += n;
    else e.Outwards += n;
    tp.set(t.partner, e);
  }
  const trend = days.map((d) => ({ name: d.slice(8) + "/" + d.slice(5, 7), value: daily.get(d) ?? 0 }));

  return (
    <div className="grid gap-2.5 md:grid-cols-2">
      <Card title="Sarees delivered · 14 days">
        <ResponsiveContainer>
          <BarChart data={trend}>
            <XAxis dataKey="name" tick={axis} interval={1} />
            <YAxis tick={axis} width={28} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="value" name="Sarees" fill="var(--brand)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card title="Client work share">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={toData(clients)} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} label={{ fontSize: 10 }}>
              {toData(clients).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </Card>
      <Card title="Process distribution">
        <ResponsiveContainer>
          <BarChart data={toData(processes).filter((p) => p.value > 0)} layout="vertical">
            <XAxis type="number" tick={axis} allowDecimals={false} />
            <YAxis type="category" dataKey="name" tick={axis} width={80} />
            <Tooltip />
            <Bar dataKey="value" name="Pieces" fill="var(--teal)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card title="Outsourced per partner (open)">
        {partners.size ? (
          <ResponsiveContainer>
            <BarChart data={toData(partners)}>
              <XAxis dataKey="name" tick={axis} />
              <YAxis tick={axis} width={28} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" name="Pieces" fill="var(--branddeep)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full grid place-items-center text-[12px] text-inkmuted">No open outsourced work.</div>
        )}
      </Card>
      <Card title="Transport packages (open)">
        {tp.size ? (
          <ResponsiveContainer>
            <BarChart data={[...tp.values()]}>
              <XAxis dataKey="name" tick={axis} />
              <YAxis tick={axis} width={28} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="Inwards" stackId="t" fill="var(--teal)" />
              <Bar dataKey="Outwards" stackId="t" fill="var(--warn)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full grid place-items-center text-[12px] text-inkmuted">No open transport entries.</div>
        )}
      </Card>
    </div>
  );
}
