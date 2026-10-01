import { createFileRoute, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { boardQuery } from "@/lib/voucher-queries";
import { addClientVoucher, addDeliveryVoucher } from "@/lib/vouchers.functions";
import { baseDelivered, num } from "@/lib/voucher-utils";
import { CLIENTS, EXTRA_PROCESSES, ITEMS, withExisting } from "@/lib/options";


export const Route = createFileRoute("/new")({
  head: () => ({
    meta: [
      { title: "New voucher — VoucherLink" },
      {
        name: "description",
        content: "Record a client voucher or issue a delivery voucher linked to it.",
      },
      { property: "og:title", content: "New voucher — VoucherLink" },
      {
        property: "og:description",
        content: "Record a client voucher or issue a linked delivery voucher.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(boardQuery),
  component: NewVoucher,
  errorComponent: ({ error }: ErrorComponentProps) => (
    <AppShell title="New voucher">
      <div className="frost rounded-2xl p-4 text-[13px] text-inkmuted">{(error as Error).message}</div>
    </AppShell>
  ),
  notFoundComponent: () => <AppShell title="Not found">Nothing here.</AppShell>,
});

const today = () => new Date().toISOString().slice(0, 10);

function Label({ children }: { children: string }) {
  return (
    <div className="text-[10px] uppercase tracking-[0.12em] text-inkmuted font-semibold mb-1">
      {children}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (e: { target: { value: string } }) => void;
  options: string[];
  placeholder: string;
}) {
  return (
    <select className="field" value={value} onChange={onChange}>
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

const digitsOnly = (v: string) => v.replace(/[^0-9]/g, "");


function NewVoucher() {
  const [tab, setTab] = useState<"client" | "delivery">("client");

  return (
    <AppShell title="New voucher" subtitle="Writes to your sheet">
      <div className="glass rounded-full p-1 flex">
        {(["client", "delivery"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-full text-[12px] font-semibold ${
              tab === t ? "bg-brand text-primary-foreground" : "text-inkmuted"
            }`}
          >
            {t === "client" ? "Client voucher" : "Delivery voucher"}
          </button>
        ))}
      </div>
      {tab === "client" ? <ClientForm /> : <DeliveryForm />}
    </AppShell>
  );
}

function ClientForm() {
  const qc = useQueryClient();
  const router = useRouter();
  const { data: board } = useSuspenseQuery(boardQuery);
  const [form, setForm] = useState({
    voucherNo: "",
    clientName: "",
    date: today(),
    item: "",
    process: "",
    quantity: "",
    notes: "",
  });
  const [done, setDone] = useState(false);

  const clients = withExisting(
    CLIENTS,
    board.clientVouchers.map((v) => v.clientName),
  );
  const items = withExisting(
    ITEMS,
    board.clientVouchers.map((v) => v.item),
  );

  const mutation = useMutation({
    mutationFn: () => addClientVoucher({ data: form }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["board"] });
      router.invalidate();
      setForm({ ...form, voucherNo: "", item: "", quantity: "", notes: "" });
      setDone(true);
    },
  });

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm({ ...form, [k]: e.target.value });
  const setNum = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm({ ...form, [k]: digitsOnly(e.target.value) });

  return (
    <div className="frost rounded-2xl p-4 space-y-3">
      <div>
        <Label>Voucher number</Label>
        <input
          className="field"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="e.g. 1001"
          value={form.voucherNo}
          onChange={setNum("voucherNo")}
        />
      </div>
      <div>
        <Label>Client name</Label>
        <Select
          value={form.clientName}
          onChange={set("clientName")}
          options={clients}
          placeholder="Select a client…"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Date</Label>
          <input type="date" className="field" value={form.date} onChange={set("date")} />
        </div>
        <div>
          <Label>Quantity</Label>
          <input
            className="field"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="0"
            value={form.quantity}
            onChange={setNum("quantity")}
          />
        </div>
      </div>
      <div>
        <Label>Item</Label>
        <Select
          value={form.item}
          onChange={set("item")}
          options={items}
          placeholder="Select an item…"
        />
      </div>
      <div>
        <Label>Notes</Label>
        <input className="field" value={form.notes} onChange={set("notes")} />
      </div>


      <button
        disabled={mutation.isPending || !form.voucherNo || !form.clientName || !form.item}
        onClick={() => {
          setDone(false);
          mutation.mutate();
        }}
        className="w-full py-3 rounded-2xl bg-brand text-primary-foreground font-display font-semibold shadow-[0_10px_24px_-10px_var(--brand)] disabled:opacity-50"
      >
        {mutation.isPending ? "Saving…" : "Save client voucher"}
      </button>
      {done && <p className="text-[12px] text-tealdeep font-semibold">Saved to your sheet.</p>}
      {mutation.isError && (
        <p className="text-[12px] text-warn font-semibold">{(mutation.error as Error).message}</p>
      )}
    </div>
  );
}

function DeliveryForm() {
  const { data: board } = useSuspenseQuery(boardQuery);
  const qc = useQueryClient();
  const router = useRouter();
  const blank = { finishing: "", returned: "", notes: "", deliveryNo: "" };
  const [form, setForm] = useState({ clientVoucherNo: "", date: today(), item: "", ...blank });
  const [extras, setExtras] = useState<Record<string, string | undefined>>({});
  const [done, setDone] = useState(false);

  const source = board.clientVouchers.find((v) => v.voucherNo === form.clientVoucherNo);
  const delivered = source ? baseDelivered(board, source.voucherNo) : 0;
  const remaining = source ? Math.max(0, num(source.quantity) - delivered) : 0;
  const baseNow = num(form.finishing) + num(form.returned);
  const overLimit = !!source && baseNow > remaining;

  const extraLines = Object.entries(extras).filter(([, q]) => q !== undefined) as [string, string][];
  const lines = [
    ...(num(form.finishing) > 0 ? [{ process: "Finishing", quantity: form.finishing }] : []),
    ...(num(form.returned) > 0 ? [{ process: "Return", quantity: form.returned }] : []),
    ...extraLines.filter(([, q]) => num(q) > 0).map(([process, quantity]) => ({ process, quantity })),
  ];
  const extrasIncomplete = extraLines.some(([, q]) => num(q) <= 0);

  const mutation = useMutation({
    mutationFn: () =>
      addDeliveryVoucher({
        data: {
          deliveryNo: form.deliveryNo,
          clientVoucherNo: form.clientVoucherNo,
          clientName: source?.clientName ?? "",
          date: form.date,
          item: form.item,
          notes: form.notes,
          lines,
        },
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["board"] });
      router.invalidate();
      setForm({ ...form, ...blank });
      setExtras({});
      setDone(true);
    },
  });

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm({ ...form, [k]: e.target.value });
  const setNum = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm({ ...form, [k]: digitsOnly(e.target.value) });

  return (
    <div className="frost rounded-2xl p-4 space-y-3">
      <div>
        <Label>Client voucher</Label>
        <select
          className="field"
          value={form.clientVoucherNo}
          onChange={(e) => setForm({ ...form, clientVoucherNo: e.target.value, item: "" })}
        >
          <option value="">Select a client voucher…</option>
          {board.clientVouchers
            .filter((v) => num(v.quantity) - baseDelivered(board, v.voucherNo) > 0)
            .map((v) => (
              <option key={v.voucherNo} value={v.voucherNo}>
                {v.voucherNo} · {v.clientName}
              </option>
            ))}
        </select>
      </div>

      {source && (
        <>
          <div>
            <Label>Item</Label>
            <Select
              value={form.item}
              onChange={set("item")}
              options={source.item ? [source.item] : []}
              placeholder="Select item…"
            />
          </div>
          <div className="rounded-2xl bg-frostline/30 p-3 text-[12px] space-y-1">
            <div className="flex justify-between">
              <span className="text-inkmuted">Client</span>
              <span className="font-semibold">{source.clientName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-inkmuted">Sarees delivered so far</span>
              <span className="font-semibold">
                {delivered} of {source.quantity || "—"}
              </span>
            </div>
          </div>
        </>
      )}

      <div>
        <Label>Delivery voucher number</Label>
        <input
          className="field"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="e.g. 5001"
          value={form.deliveryNo}
          onChange={setNum("deliveryNo")}
        />
      </div>
      <div>
        <Label>Date</Label>
        <input type="date" className="field" value={form.date} onChange={set("date")} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Finishing qty</Label>
          <input
            className="field"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="0"
            value={form.finishing}
            onChange={setNum("finishing")}
          />
        </div>
        <div>
          <Label>Return qty (optional)</Label>
          <input
            className="field"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="0"
            value={form.returned}
            onChange={setNum("returned")}
          />
        </div>
      </div>
      {source && (
        <p className={`text-[12px] font-semibold ${overLimit ? "text-warn" : "text-inkmuted"}`}>
          {overLimit
            ? `Too much — only ${remaining} sarees left (finishing + return).`
            : `Up to ${remaining} sarees can be delivered (finishing + return).`}
        </p>
      )}

      <div>
        <Label>Additional work (optional)</Label>
        <div className="space-y-2">
          {EXTRA_PROCESSES.map((p) => {
            const on = extras[p] !== undefined;
            return (
              <div key={p} className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-[13px] flex-1">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) => setExtras({ ...extras, [p]: e.target.checked ? "" : undefined })}
                  />
                  {p}
                </label>
                {on && (
                  <input
                    className="field max-w-[110px]"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="Qty"
                    aria-label={`${p} quantity`}
                    value={extras[p]}
                    onChange={(e) => setExtras({ ...extras, [p]: digitsOnly(e.target.value) })}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <Label>Notes</Label>
        <input className="field" value={form.notes} onChange={set("notes")} />
      </div>

      <button
        disabled={
          mutation.isPending ||
          !form.deliveryNo ||
          !form.clientVoucherNo ||
          !form.item ||
          lines.length === 0 ||
          extrasIncomplete ||
          overLimit
        }
        onClick={() => {
          setDone(false);
          mutation.mutate();
        }}
        className="w-full py-3 rounded-2xl bg-brand text-primary-foreground font-display font-semibold shadow-[0_10px_24px_-10px_var(--brand)] disabled:opacity-50"
      >
        {mutation.isPending ? "Saving…" : "Issue delivery voucher"}
      </button>
      {done && <p className="text-[12px] text-tealdeep font-semibold">Linked and saved.</p>}
      {mutation.isError && (
        <p className="text-[12px] text-warn font-semibold">{(mutation.error as Error).message}</p>
      )}
    </div>
  );
}
