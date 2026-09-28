import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { boardQuery } from "@/lib/voucher-queries";
import { addClientVoucher, addDeliveryVoucher } from "@/lib/vouchers.functions";
import { deliveriesFor, num } from "@/lib/voucher-utils";
import { CLIENTS, ITEMS, PROCESSES, withExisting } from "@/lib/options";


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
  errorComponent: ({ error }: { error: Error }) => (
    <AppShell title="New voucher">
      <div className="frost rounded-2xl p-4 text-[13px] text-inkmuted">{error.message}</div>
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
  const processes = withExisting(
    PROCESSES,
    board.clientVouchers.map((v) => v.process),
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
        <Label>Process</Label>
        <Select
          value={form.process}
          onChange={set("process")}
          options={processes}
          placeholder="Select a process…"
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
  const [form, setForm] = useState({
    deliveryNo: "",
    clientVoucherNo: "",
    date: today(),
    quantity: "",
    notes: "",
  });
  const [done, setDone] = useState(false);

  const source = board.clientVouchers.find((v) => v.voucherNo === form.clientVoucherNo);
  const delivered = source
    ? deliveriesFor(board, source.voucherNo).reduce((s, d) => s + num(d.quantity), 0)
    : 0;
  const remaining = source ? Math.max(0, num(source.quantity) - delivered) : 0;
  const overLimit = !!source && num(form.quantity) > remaining;

  const mutation = useMutation({
    mutationFn: () =>
      addDeliveryVoucher({
        data: {
          deliveryNo: form.deliveryNo,
          clientVoucherNo: form.clientVoucherNo,
          clientName: source?.clientName ?? "",
          date: form.date,
          item: source?.item ?? "",
          process: source?.process ?? "",
          quantity: form.quantity,
          notes: form.notes,
        },
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["board"] });
      router.invalidate();
      setForm({ ...form, deliveryNo: "", quantity: "", notes: "" });
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
        <select className="field" value={form.clientVoucherNo} onChange={set("clientVoucherNo")}>
          <option value="">Select a client voucher…</option>
          {board.clientVouchers.map((v) => (
            <option key={v.voucherNo} value={v.voucherNo}>
              {v.voucherNo} · {v.clientName}
            </option>
          ))}
        </select>
      </div>

      {source && (
        <div className="rounded-2xl bg-frostline/30 p-3 text-[12px] space-y-1">
          <div className="flex justify-between">
            <span className="text-inkmuted">Client</span>
            <span className="font-semibold">{source.clientName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-inkmuted">Item · process</span>
            <span className="font-semibold">
              {source.item}
              {source.process ? ` · ${source.process}` : ""}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-inkmuted">Delivered so far</span>
            <span className="font-semibold">
              {delivered} of {source.quantity || "—"}
            </span>
          </div>
        </div>
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
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Date</Label>
          <input type="date" className="field" value={form.date} onChange={set("date")} />
        </div>
        <div>
          <Label>Quantity delivered</Label>
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
        <Label>Notes</Label>
        <input className="field" value={form.notes} onChange={set("notes")} />
      </div>

      <button
        disabled={mutation.isPending || !form.deliveryNo || !form.clientVoucherNo}
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
