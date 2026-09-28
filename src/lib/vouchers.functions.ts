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
    clientVouchers: cRows
      .filter((r) => at(r, 0) !== "")
      .map((r) => ({
        voucherNo: at(r, 0),
        clientName: at(r, 1),
        date: at(r, 2),
        item: at(r, 3),
        process: at(r, 4),
        quantity: at(r, 5),
        notes: at(r, 6),
        createdAt: at(r, 7),
      }))
      .reverse(),
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
  item: z.string().min(1),
  process: z.string().default(""),
  quantity: z.string().default(""),
  notes: z.string().default(""),
});

export const addClientVoucher = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => clientSchema.parse(d))
  .handler(async ({ data }) => {
    const { appendRow, CLIENT_SHEET } = await import("./sheets.server");
    await appendRow(CLIENT_SHEET, [
      data.voucherNo,
      data.clientName,
      data.date,
      data.item,
      data.process,
      data.quantity,
      data.notes,
      new Date().toISOString(),
    ]);
    return { ok: true };
  });

const deliverySchema = z.object({
  deliveryNo: z.string().min(1),
  clientVoucherNo: z.string().min(1),
  clientName: z.string().default(""),
  date: z.string().min(1),
  item: z.string().default(""),
  process: z.string().default(""),
  quantity: z.string().default(""),
  notes: z.string().default(""),
});

export const addDeliveryVoucher = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => deliverySchema.parse(d))
  .handler(async ({ data }) => {
    const { appendRow, readRange, CLIENT_SHEET, DELIVERY_SHEET } = await import("./sheets.server");
    const toNum = (v: string | undefined) => {
      const n = Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
      return Number.isFinite(n) ? n : 0;
    };
    const key = data.clientVoucherNo.trim().toLowerCase();
    const [cRows, dRows] = await Promise.all([
      readRange(`${CLIENT_SHEET}!A2:F`),
      readRange(`${DELIVERY_SHEET}!A2:G`),
    ]);
    const src = cRows.find((r) => (r[0] ?? "").trim().toLowerCase() === key);
    if (!src) throw new Error(`Client voucher ${data.clientVoucherNo} not found.`);
    const already = dRows
      .filter((r) => (r[1] ?? "").trim().toLowerCase() === key)
      .reduce((s, r) => s + toNum(r[6]), 0);
    const remaining = toNum(src[5]) - already;
    if (toNum(data.quantity) <= 0) throw new Error("Enter a quantity greater than 0.");
    if (toNum(data.quantity) > remaining)
      throw new Error(`Only ${Math.max(0, remaining)} left to deliver on voucher ${data.clientVoucherNo}.`);
    await appendRow(DELIVERY_SHEET, [
      data.deliveryNo,
      data.clientVoucherNo,
      data.clientName,
      data.date,
      data.item,
      data.process,
      data.quantity,
      data.notes,
      new Date().toISOString(),
    ]);
    return { ok: true };
  });
