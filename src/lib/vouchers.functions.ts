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
  /** True when the row has been moved to the archive after a finalized statement. */
  archived?: boolean;
};

export type OutsourceEntry = {
  date: string;
  partner: string;
  party: string;
  process: string;
  quantity: string;
  createdAt: string;
};

export type StatementRecord = {
  id: string;
  type: string;
  name: string;
  from: string;
  to: string;
  rows: string;
  total: string;
  driveUrl: string;
  createdAt: string;
};

export type Board = {
  clientVouchers: ClientVoucher[];
  /** Active and archived deliveries; archived ones still count toward balances. */
  deliveryVouchers: DeliveryVoucher[];
  outsourcing: OutsourceEntry[];
  history: StatementRecord[];
  options: { partners: string[]; processes: string[] };
};

export const getBoard = createServerFn({ method: "GET" }).handler(async (): Promise<Board> => {
  const S = await import("./sheets.server");
  const { readRange, readSheet, CLIENT_SHEET, DELIVERY_SHEET } = S;
  const [cRows, dRows, aRows, oRows, hRows, optRows] = await Promise.all([
    readRange(`${CLIENT_SHEET}!A2:H`),
    readRange(`${DELIVERY_SHEET}!A2:I`),
    readSheet(S.ARCHIVED_DELIVERY_SHEET, "K"),
    readSheet(S.OUTSOURCE_SHEET, "F"),
    readSheet(S.HISTORY_SHEET, "J"),
    readSheet(S.OPTIONS_SHEET, "B"),
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
    outsourcing: oRows
      .filter((r) => at(r, 1) !== "")
      .map((r) => ({
        date: at(r, 0),
        partner: at(r, 1),
        party: at(r, 2),
        process: at(r, 3),
        quantity: at(r, 4),
        createdAt: at(r, 5),
      }))
      .reverse(),
    history: hRows
      .filter((r) => at(r, 0) !== "")
      .map((r) => ({
        id: at(r, 0),
        type: at(r, 1),
        name: at(r, 2),
        from: at(r, 3),
        to: at(r, 4),
        rows: at(r, 5),
        total: at(r, 6),
        driveUrl: at(r, 8),
        createdAt: at(r, 9),
      }))
      .reverse(),
    options: {
      partners: optRows.filter((r) => at(r, 0) === "partner").map((r) => at(r, 1)),
      processes: optRows.filter((r) => at(r, 0) === "process").map((r) => at(r, 1)),
    },
    deliveryVouchers: [
      ...aRows.filter((r) => at(r, 0) !== "").map((r) => [...r.slice(0, 9), "archived"]),
      ...dRows.filter((r) => at(r, 0) !== ""),
    ]
      .map((r) => ({
        archived: at(r, 9) === "archived",
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
    const { readSheet, ARCHIVED_DELIVERY_SHEET } = await import("./sheets.server");
    const [cRows, activeRows, archivedRows] = await Promise.all([
      readRange(`${CLIENT_SHEET}!A2:F`),
      readRange(`${DELIVERY_SHEET}!A2:G`),
      readSheet(ARCHIVED_DELIVERY_SHEET, "G"),
    ]);
    const dRows = [...activeRows, ...archivedRows];
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

const outsourceSchema = z.object({
  date: z.string().min(1),
  partner: z.string().trim().min(1).max(100),
  party: z.string().trim().min(1).max(100),
  process: z.string().trim().min(1).max(100),
  quantity: z.string().regex(/^[0-9]+$/),
  newPartner: z.boolean().default(false),
  newProcess: z.boolean().default(false),
});

export const addOutsourcing = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => outsourceSchema.parse(d))
  .handler(async ({ data }) => {
    const S = await import("./sheets.server");
    if (Number(data.quantity) <= 0) throw new Error("Quantity must be greater than 0.");
    await S.ensureSheet(S.OUTSOURCE_SHEET);
    const opts: string[][] = [];
    if (data.newPartner) opts.push(["partner", data.partner]);
    if (data.newProcess) opts.push(["process", data.process]);
    if (opts.length) {
      await S.ensureSheet(S.OPTIONS_SHEET);
      await S.appendRows(S.OPTIONS_SHEET, opts);
    }
    await S.appendRows(S.OUTSOURCE_SHEET, [
      [data.date, data.partner, data.party, data.process, data.quantity, new Date().toISOString()],
    ]);
    return { ok: true };
  });

const finalizeSchema = z.object({
  kind: z.enum(["client", "partner"]),
  name: z.string().min(1),
  from: z.string(),
  to: z.string(),
  fileName: z.string().min(1).max(200),
  pdfBase64: z.string().min(1),
  total: z.number(),
  /** Row keys (Created At|first col|...) identifying exactly which rows to archive. */
  keys: z.array(z.string()).min(1),
});

/** Row key used by the client to point at specific sheet rows. */
export function deliveryKey(r: { createdAt: string; deliveryNo: string; item: string; process: string; quantity: string }) {
  return [r.createdAt, r.deliveryNo, r.item, r.process, r.quantity].join("|");
}
export function outsourceKey(r: { createdAt: string; partner: string; party: string; process: string; quantity: string }) {
  return [r.createdAt, r.partner, r.party, r.process, r.quantity].join("|");
}

export const finalizeStatement = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => finalizeSchema.parse(d))
  .handler(async ({ data }) => {
    const S = await import("./sheets.server");
    const { uploadPdf } = await import("./drive.server");
    const isClient = data.kind === "client";
    const active = isClient ? S.DELIVERY_SHEET : S.OUTSOURCE_SHEET;
    const archive = isClient ? S.ARCHIVED_DELIVERY_SHEET : S.ARCHIVED_OUTSOURCE_SHEET;
    await S.ensureSheet(active);
    const rows = await S.readRange(`${active}!A2:${isClient ? "I" : "F"}`);
    const keyOf = (r: string[]) =>
      isClient
        ? [r[8] ?? "", r[0] ?? "", r[4] ?? "", r[5] ?? "", r[6] ?? ""].join("|")
        : [r[5] ?? "", r[1] ?? "", r[2] ?? "", r[3] ?? "", r[4] ?? ""].join("|");
    const wanted = new Set(data.keys);
    const moving = rows.filter((r) => wanted.has(keyOf(r)));
    if (moving.length !== data.keys.length)
      throw new Error("Some rows changed since the preview. Refresh and try again.");

    const file = await uploadPdf(
      isClient ? "Client Statements" : "Outsourcing Reports",
      data.fileName,
      data.pdfBase64,
    );
    const now = new Date().toISOString();
    const id = `ST-${now.replace(/[-:TZ.]/g, "").slice(0, 14)}`;
    const width = isClient ? 9 : 6;
    const pad = (r: string[]) => Array.from({ length: width }, (_, i) => r[i] ?? "");
    await S.ensureSheet(archive);
    await S.appendRows(archive, moving.map((r) => [...pad(r), now, id]));
    await S.rewriteRows(active, rows.filter((r) => !wanted.has(keyOf(r))).map(pad));
    await S.ensureSheet(S.HISTORY_SHEET);
    await S.appendRows(S.HISTORY_SHEET, [
      [id, isClient ? "Client" : "Partner", data.name, data.from, data.to, String(moving.length), String(data.total), file.id, file.webViewLink, now],
    ]);
    return { id, url: file.webViewLink };
  });
