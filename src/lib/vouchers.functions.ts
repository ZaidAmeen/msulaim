import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type ClientVoucher = {
  voucherNo: string;
  clientName: string;
  date: string;
  item: string;
  process: string;
  quantity: string;
  notes: string;
  createdAt: string;
  /** One entry per item row in the sheet (a voucher can carry several items). */
  items: { item: string; quantity: string }[];
};

export type DeliveryVoucher = {
  deliveryNo: string;
  clientVoucherNo: string;
  clientName: string;
  date: string;
  item: string;
  process: string;
  quantity: string;
  notes: string;
  createdAt: string;
};

export type Board = {
  clientVouchers: ClientVoucher[];
  deliveryVouchers: DeliveryVoucher[];
};

export const getBoard = createServerFn({ method: "GET" }).handler(async (): Promise<Board> => {
  const { readRange, CLIENT_SHEET, DELIVERY_SHEET } = await import("./sheets.server");
  const [cRows, dRows] = await Promise.all([
    readRange(`${CLIENT_SHEET}!A2:H`),
    readRange(`${DELIVERY_SHEET}!A2:I`),
  ]);
  const at = (r: string[], i: number) => r[i] ?? "";
  return {
    clientVouchers: (() => {
      const map = new Map<string, ClientVoucher>();
      for (const r of cRows) {
        if (at(r, 0) === "") continue;
        const key = at(r, 0).trim().toLowerCase();
        const ex = map.get(key);
        if (ex) {
          ex.items.push({ item: at(r, 3), quantity: at(r, 5) });
          continue;
        }
        map.set(key, {
          voucherNo: at(r, 0),
          clientName: at(r, 1),
          date: at(r, 2),
          item: "",
          process: at(r, 4),
          quantity: "",
          notes: at(r, 6),
          createdAt: at(r, 7),
          items: [{ item: at(r, 3), quantity: at(r, 5) }],
        });
      }
      const toN = (v: string) => {
        const n = Number(String(v).replace(/[^0-9.-]/g, ""));
        return Number.isFinite(n) ? n : 0;
      };
      return [...map.values()]
        .map((v) => ({
          ...v,
          item: v.items.map((i) => i.item).join(", "),
          quantity: String(v.items.reduce((s, i) => s + toN(i.quantity), 0)),
        }))
        .reverse();
    })(),
    deliveryVouchers: dRows
      .filter((r) => at(r, 0) !== "")
      .map((r) => ({
        deliveryNo: at(r, 0),
        clientVoucherNo: at(r, 1),
        clientName: at(r, 2),
        date: at(r, 3),
        item: at(r, 4),
        process: at(r, 5),
        quantity: at(r, 6),
        notes: at(r, 7),
        createdAt: at(r, 8),
      }))
      .reverse(),
  };
});

const clientSchema = z.object({
  voucherNo: z.string().min(1),
  clientName: z.string().min(1),
  date: z.string().min(1),
  notes: z.string().default(""),
  items: z.array(z.object({ item: z.string().min(1), quantity: z.string().min(1) })).min(1),
});

export const addClientVoucher = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => clientSchema.parse(d))
  .handler(async ({ data }) => {
    const { appendRows, readRange, CLIENT_SHEET } = await import("./sheets.server");
    const existing = await readRange(`${CLIENT_SHEET}!A2:A`);
    const key = data.voucherNo.trim().toLowerCase();
    if (existing.some((r) => (r[0] ?? "").trim().toLowerCase() === key))
      throw new Error(`Client voucher ${data.voucherNo} already exists.`);
    const now = new Date().toISOString();
    await appendRows(
      CLIENT_SHEET,
      data.items.map((i) => [
        data.voucherNo,
        data.clientName,
        data.date,
        i.item,
        "",
        i.quantity,
        data.notes,
        now,
      ]),
    );
    return { ok: true };
  });

const deliverySchema = z.object({
  deliveryNo: z.string().min(1),
  clientVoucherNo: z.string().min(1),
  clientName: z.string().default(""),
  date: z.string().min(1),
  notes: z.string().default(""),
  lines: z
    .array(
      z.object({ item: z.string().min(1), process: z.string().min(1), quantity: z.string().min(1) }),
    )
    .min(1),
});

export const addDeliveryVoucher = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => deliverySchema.parse(d))
  .handler(async ({ data }) => {
    const { appendRows, readRange, CLIENT_SHEET, DELIVERY_SHEET } = await import("./sheets.server");
    const toNum = (v: string | undefined) => {
      const n = Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
      return Number.isFinite(n) ? n : 0;
    };
    const isBase = (p: string | undefined) => {
      const t = (p ?? "").trim().toLowerCase();
      return t === "" || t === "finishing" || t === "return";
    };
    const key = data.clientVoucherNo.trim().toLowerCase();
    const norm = (v: string | undefined) => (v ?? "").trim().toLowerCase();
    const [cRows, dRows] = await Promise.all([
      readRange(`${CLIENT_SHEET}!A2:F`),
      readRange(`${DELIVERY_SHEET}!A2:G`),
    ]);
    const srcRows = cRows.filter((r) => norm(r[0]) === key);
    if (!srcRows.length) throw new Error(`Client voucher ${data.clientVoucherNo} not found.`);
    if (data.lines.some((l) => toNum(l.quantity) <= 0))
      throw new Error("Enter quantities greater than 0.");
    const items = [...new Set(data.lines.map((l) => l.item))];
    for (const item of items) {
      const ik = norm(item);
      const ordered = srcRows.filter((r) => norm(r[3]) === ik).reduce((s, r) => s + toNum(r[5]), 0);
      if (!srcRows.some((r) => norm(r[3]) === ik))
        throw new Error(`${item} is not on voucher ${data.clientVoucherNo}.`);
      // Legacy rows with no item count against the voucher's only item.
      const single = srcRows.length === 1;
      const already = dRows
        .filter(
          (r) => norm(r[1]) === key && isBase(r[5]) && (norm(r[4]) === ik || (single && !norm(r[4]))),
        )
        .reduce((s, r) => s + toNum(r[6]), 0);
      const remaining = ordered - already;
      const baseNow = data.lines
        .filter((l) => l.item === item && isBase(l.process))
        .reduce((s, l) => s + toNum(l.quantity), 0);
      if (baseNow > remaining)
        throw new Error(`Only ${Math.max(0, remaining)} ${item} left to deliver on voucher ${data.clientVoucherNo}.`);
    }
    const now = new Date().toISOString();
    await appendRows(
      DELIVERY_SHEET,
      data.lines.map((l) => [
        data.deliveryNo,
        data.clientVoucherNo,
        data.clientName,
        data.date,
        l.item,
        l.process,
        l.quantity,
        data.notes,
        now,
      ]),
    );
    return { ok: true };
  });
