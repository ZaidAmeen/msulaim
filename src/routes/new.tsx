import { createFileRoute, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { boardQuery } from "@/lib/voucher-queries";
import { addClientVoucher, addDeliveryVoucher } from "@/lib/vouchers.functions";
import { itemStatus, num } from "@/lib/voucher-utils";
import { CLIENTS, EXTRA_PROCESSES, ITEMS, withExisting } from "@/lib/options";


export const Route = createFileRoute("/new")({
  head: () => ({
    meta: [
      { title: "New voucher — M Sulaim" },
      {
        name: "description",
        content: "Record a client voucher or issue a delivery voucher linked to it.",
      },
      { property: "og:title", content: "New voucher — M Sulaim" },
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
  const [form, setForm] = useState({ voucherNo: "", clientName: "", date: today(), notes: "" });
  const [items, setItems] = useState([{ item: "", quantity: "" }]);
  const [done, setDone] = useState(false);

  const clients = withExisting(CLIENTS, board.clientVouchers.map((v) => v.clientName));
  const itemOptions = withExisting(
    ITEMS,
    board.clientVouchers.flatMap((v) => v.items.map((i) => i.item)),
  );
  const exists = board.clientVouchers.some(
    (v) => v.voucherNo.trim().toLowerCase() === form.voucherNo.trim().toLowerCase(),
  );
  const chosen = items.map((i) => i.item).filter(Boolean);
  const dupItem = new Set(chosen).size !== chosen.length;
  const itemsOk = items.every((i) => i.item && num(i.quantity) > 0) && !dupItem;

  const mutation = useMutation({
    mutationFn: () => addClientVoucher({ data: { ...form, items } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["board"] });
      router.invalidate();
      setForm({ ...form, voucherNo: "", notes: "" });
      setItems([{ item: "", quantity: "" }]);
      setDone(true);
    },
  });

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm({ ...form, [k]: e.target.value });
  const setItem = (idx: number, k: "item" | "quantity", v: string) =>
    setItems(items.map((it, i) => (i === idx ? { ...it, [k]: v } : it)));

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
          onChange={(e) => setForm({ ...form, voucherNo: digitsOnly(e.target.value) })}
        />
        {exists && (
          <p className="text-[12px] text-warn font-semibold mt-1">This voucher number already exists.</p>
        )}
      </div>
      <div>
        <Label>Client name</Label>
        <Select value={form.clientName} onChange={set("clientName")} options={clients} placeholder="Select a client…" />
      </div>
      <div>
        <Label>Date</Label>
        <input type="date" className="field" value={form.date} onChange={set("date")} />
      </div>

      <div>
        <Label>Items</Label>
        <div className="space-y-2">
          {items.map((it, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <div className="flex-1">
                <Select
                  value={it.item}
                  onChange={(e) => setItem(idx, "item", e.target.value)}
                  options={itemOptions}
                  placeholder="Select an item…"
                />
              </div>
              <input
                className="field max-w-[90px]"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Qty"
                aria-label="Quantity"
                value={it.quantity}
                onChange={(e) => setItem(idx, "quantity", digitsOnly(e.target.value))}
              />
              {items.length > 1 && (
                <button
                  type="button"
                  aria-label="Remove item"
                  onClick={() => setItems(items.filter((_, i) => i !== idx))}
                  className="text-inkmuted text-[18px] px-1"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setItems([...items, { item: "", quantity: "" }])}
          className="mt-2 text-[12px] font-semibold text-brand"
        >
          + Add another item
        </button>
        {dupItem && <p className="text-[12px] text-warn font-semibold mt-1">Each item can only be listed once.</p>}
      </div>

      <div>
        <Label>Notes</Label>
        <input className="field" value={form.notes} onChange={set("notes")} />
      </div>

      <button
        disabled={mutation.isPending || !form.voucherNo || !form.clientName || !itemsOk || exists}
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

type Block = { item: string; finishing: string; returned: string; extras: Record<string, string | undefined> };
const blankBlock = (): Block => ({ item: "", finishing: "", returned: "", extras: {} });

function DeliveryForm() {
  const { data: board } = useSuspenseQuery(boardQuery);
  const qc = useQueryClient();
  const router = useRouter();
  const [form, setForm] = useState({ clientVoucherNo: "", date: today(), notes: "", deliveryNo: "" });
  const [blocks, setBlocks] = useState<Block[]>([blankBlock()]);
  const [done, setDone] = useState(false);

  const source = board.clientVouchers.find((v) => v.voucherNo === form.clientVoucherNo);
  const status = source ? itemStatus(board, source) : [];
  const open = status.filter((s) => s.remaining > 0);

  const lines = blocks.flatMap((b) =>
    !b.item
      ? []
      : [
          ...(num(b.finishing) > 0 ? [{ item: b.item, process: "Finishing", quantity: b.finishing }] : []),
          ...(num(b.returned) > 0 ? [{ item: b.item, process: "Return", quantity: b.returned }] : []),
          ...Object.entries(b.extras)
            .filter(([, q]) => q !== undefined && num(q) > 0)
            .map(([process, quantity]) => ({ item: b.item, process, quantity: quantity as string })),
        ],
  );
  const overBlock = (b: Block) => {
    const st = status.find((s) => s.item === b.item);
    return !!st && num(b.finishing) + num(b.returned) > st.remaining;
  };
  const anyOver = blocks.some(overBlock);
  const incomplete = blocks.some(
    (b) => !b.item || Object.values(b.extras).some((q) => q !== undefined && num(q) <= 0),
  );

  const mutation = useMutation({
    mutationFn: () =>
      addDeliveryVoucher({
        data: {
          deliveryNo: form.deliveryNo,
          clientVoucherNo: form.clientVoucherNo,
          clientName: source?.clientName ?? "",
          date: form.date,
          notes: form.notes,
          lines,
        },
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["board"] });
      router.invalidate();
      setForm({ ...form, notes: "", deliveryNo: "" });
      setBlocks([blankBlock()]);
      setDone(true);
    },
  });

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm({ ...form, [k]: e.target.value });
  const upd = (idx: number, patch: Partial<Block>) =>
    setBlocks(blocks.map((b, i) => (i === idx ? { ...b, ...patch } : b)));

  return (
    <div className="frost rounded-2xl p-4 space-y-3">
      <div>
        <Label>Client voucher</Label>
        <select
          className="field"
          value={form.clientVoucherNo}
          onChange={(e) => {
            setForm({ ...form, clientVoucherNo: e.target.value });
            setBlocks([blankBlock()]);
          }}
        >
          <option value="">Select a client voucher…</option>
          {board.clientVouchers
            .filter((v) => itemStatus(board, v).some((s) => s.remaining > 0))
            .map((v) => (
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
          {status.map((s) => (
            <div key={s.item} className="flex justify-between">
              <span className="text-inkmuted">{s.item}</span>
              <span className="font-semibold">
                {s.delivered} of {s.ordered} delivered
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Delivery voucher no.</Label>
          <input
            className="field"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="e.g. 5001"
            value={form.deliveryNo}
            onChange={(e) => setForm({ ...form, deliveryNo: digitsOnly(e.target.value) })}
          />
        </div>
        <div>
          <Label>Date</Label>
          <input type="date" className="field" value={form.date} onChange={set("date")} />
        </div>
      </div>

      {source &&
        blocks.map((b, idx) => {
          const st = status.find((s) => s.item === b.item);
          const taken = blocks.filter((_, i) => i !== idx).map((x) => x.item);
          const options = open.map((s) => s.item).filter((i) => !taken.includes(i));
          const over = overBlock(b);
          return (
            <div key={idx} className="rounded-2xl border border-frostline/60 p-3 space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Label>{`Item ${idx + 1}`}</Label>
                  <Select
                    value={b.item}
                    onChange={(e) => upd(idx, { item: e.target.value })}
                    options={b.item && !options.includes(b.item) ? [b.item, ...options] : options}
                    placeholder="Select item…"
                  />
                </div>
                {blocks.length > 1 && (
                  <button
                    type="button"
                    aria-label="Remove item"
                    onClick={() => setBlocks(blocks.filter((_, i) => i !== idx))}
                    className="text-inkmuted text-[18px] px-1 mt-4"
                  >
                    ×
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Finishing qty</Label>
                  <input
                    className="field"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="0"
                    value={b.finishing}
                    onChange={(e) => upd(idx, { finishing: digitsOnly(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Return qty (optional)</Label>
                  <input
                    className="field"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="0"
                    value={b.returned}
                    onChange={(e) => upd(idx, { returned: digitsOnly(e.target.value) })}
                  />
                </div>
              </div>
              {st && (
                <p className={`text-[12px] font-semibold ${over ? "text-warn" : "text-inkmuted"}`}>
                  {over
                    ? `Too much — only ${st.remaining} ${st.item} left (finishing + return).`
                    : `Up to ${st.remaining} ${st.item} can be delivered (finishing + return).`}
                </p>
              )}
              <div>
                <Label>Additional work (optional)</Label>
                <div className="space-y-2">
                  {EXTRA_PROCESSES.map((p) => {
                    const on = b.extras[p] !== undefined;
                    return (
                      <div key={p} className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-[13px] flex-1">
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={(e) =>
                              upd(idx, { extras: { ...b.extras, [p]: e.target.checked ? "" : undefined } })
                            }
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
                            value={b.extras[p]}
                            onChange={(e) =>
                              upd(idx, { extras: { ...b.extras, [p]: digitsOnly(e.target.value) } })
                            }
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}

      {source && blocks.length < open.length && (
        <button
          type="button"
          onClick={() => setBlocks([...blocks, blankBlock()])}
          className="text-[12px] font-semibold text-brand"
        >
          + Add another item
        </button>
      )}

      <div>
        <Label>Notes</Label>
        <input className="field" value={form.notes} onChange={set("notes")} />
      </div>

      <button
        disabled={
          mutation.isPending ||
          !form.deliveryNo ||
          !form.clientVoucherNo ||
          lines.length === 0 ||
          incomplete ||
          anyOver
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
