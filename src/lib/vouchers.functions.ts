import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAllowed } from "./access-middleware";
import { z } from "zod";

/** Case-insensitive de-duplication that keeps the first spelling. */
function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const t = v.trim();
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
  }
  return out;
}


export type ClientVoucher = {
  voucherNo: string;
  clientName: string;
  date: string;
  item: string;
  process: string;
  quantity: string;
  notes: string;
  createdAt: string;
  /** Manually marked fully delivered (orders with no Finishing/Return work). */
  completed: boolean;
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

export type TransportEntry = {
  date: string;
  partner: string;
  client: string;
  direction: string;
  boxes: string;
  bags: string;
  covers: string;
  notes: string;
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
  transport: TransportEntry[];
  history: StatementRecord[];
  business: { name: string; subtitle: string; location: string };
  options: {
    clients: string[];
    items: string[];
    /** Delivery processes beyond Finishing/Return (Blouse Stitch, Piping, …). */
    processes: string[];
    /** Outsourcing processes. */
    outProcesses: string[];
    partners: string[];
    transporters: string[];
  };
};

/** 45s server-side board cache; purged by every write so users always see fresh data. */
let boardCache: { at: number; board: Board } | null = null;
export function invalidateBoard() {
  boardCache = null;
}

export const getBoard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth, requireAllowed])
  .handler(async (): Promise<Board> => {
    const now = Date.now();
    if (boardCache && now - boardCache.at < 45_000) return boardCache.board;
    const S = await import("./sheets.server");
    const [cRows, dRows, aRows, oRows, hRows, optRows, tRows] = await S.readBoardRaw();
    const at = (r: string[], i: number) => r[i] ?? "";
    const board: Board = {
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
          completed: at(r, 8).trim().toLowerCase() === "yes",
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
      clients: dedupe(optRows.filter((r) => at(r, 0) === "client").map((r) => at(r, 1))),
      items: dedupe(optRows.filter((r) => at(r, 0) === "item").map((r) => at(r, 1))),
      processes: dedupe(optRows.filter((r) => at(r, 0) === "dprocess").map((r) => at(r, 1))),
      outProcesses: dedupe(optRows.filter((r) => at(r, 0) === "process").map((r) => at(r, 1))),
      partners: dedupe(optRows.filter((r) => at(r, 0) === "partner").map((r) => at(r, 1))),
      transporters: dedupe(optRows.filter((r) => at(r, 0) === "transporter").map((r) => at(r, 1))),
    },
    business: {
      name: optRows.filter((r) => at(r, 0) === "business_name").map((r) => at(r, 1)).at(-1) ?? "",
      subtitle: optRows.filter((r) => at(r, 0) === "business_subtitle").map((r) => at(r, 1)).at(-1) ?? "",
      location: optRows.filter((r) => at(r, 0) === "business_location").map((r) => at(r, 1)).at(-1) ?? "",
    },
    transport: tRows
      .filter((r) => at(r, 1) !== "")
      .map((r) => ({
        date: at(r, 0),
        partner: at(r, 1),
        client: at(r, 2),
        direction: at(r, 3),
        boxes: at(r, 4),
        bags: at(r, 5),
        covers: at(r, 6),
        notes: at(r, 7),
        createdAt: at(r, 8),
      }))
      .reverse(),
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
    boardCache = { at: now, board };
    return board;
  });

const clientSchema = z.object({
  voucherNo: z.string().min(1),
  clientName: z.string().min(1),
  date: z.string().min(1),
  notes: z.string().default(""),
  items: z.array(z.object({ item: z.string().min(1), quantity: z.string().min(1) })).min(1),
});

export const addClientVoucher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAllowed])
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
        "",
      ]),
    );
    invalidateBoard();
    return { ok: true };
  });

/** Manually mark a voucher fully delivered (for orders without Finishing/Return). */
export const setVoucherCompleted = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAllowed])
  .inputValidator((d: unknown) =>
    z.object({ voucherNo: z.string().min(1), completed: z.boolean() }).parse(d),
  )
  .handler(async ({ data }) => {
    const S = await import("./sheets.server");
    const rows = await S.readRange(`${S.CLIENT_SHEET}!A2:I`);
    const key = data.voucherNo.trim().toLowerCase();
    const pad = (r: string[]) => Array.from({ length: 9 }, (_, i) => r[i] ?? "");
    let hit = false;
    const updated = rows.map((r) => {
      if ((r[0] ?? "").trim().toLowerCase() !== key) return pad(r);
      hit = true;
      return pad(r).map((v, i) => (i === 8 ? (data.completed ? "yes" : "") : v));
    });
    if (!hit) throw new Error(`Client voucher ${data.voucherNo} not found.`);
    await S.rewriteRows(S.CLIENT_SHEET, updated);
    invalidateBoard();
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
  .middleware([requireSupabaseAuth, requireAllowed])
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
    invalidateBoard();
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
  .middleware([requireSupabaseAuth, requireAllowed])
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
    invalidateBoard();
    return { ok: true };
  });

const count = z.string().regex(/^[0-9]*$/).default("");
const transportSchema = z.object({
  date: z.string().min(1),
  partner: z.string().trim().min(1).max(100),
  client: z.string().trim().min(1).max(100),
  direction: z.enum(["Inwards", "Outwards"]),
  boxes: count,
  bags: count,
  covers: count,
  notes: z.string().max(500).default(""),
  newPartner: z.boolean().default(false),
});

export const addTransport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAllowed])
  .inputValidator((d: unknown) => transportSchema.parse(d))
  .handler(async ({ data }) => {
    const S = await import("./sheets.server");
    const total = [data.boxes, data.bags, data.covers].reduce((s, v) => s + Number(v || 0), 0);
    if (total <= 0) throw new Error("Enter at least one box, bag or cover.");
    await S.ensureSheet(S.TRANSPORT_SHEET);
    if (data.newPartner) {
      await S.ensureSheet(S.OPTIONS_SHEET);
      await S.appendRows(S.OPTIONS_SHEET, [["transporter", data.partner]]);
    }
    await S.appendRows(S.TRANSPORT_SHEET, [
      [data.date, data.partner, data.client, data.direction, data.boxes, data.bags, data.covers, data.notes, new Date().toISOString()],
    ]);
    invalidateBoard();
    return { ok: true };
  });

const finalizeSchema = z.object({
  kind: z.enum(["client", "partner", "transport"]),
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

export function transportKey(r: { createdAt: string; partner: string; client: string; direction: string; boxes: string; bags: string; covers: string }) {
  return [r.createdAt, r.partner, r.client, r.direction, r.boxes, r.bags, r.covers].join("|");
}

export const finalizeStatement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAllowed])
  .inputValidator((d: unknown) => finalizeSchema.parse(d))
  .handler(async ({ data }) => {
    const S = await import("./sheets.server");
    const { uploadPdf } = await import("./drive.server");
    const cfg = {
      client: { active: S.DELIVERY_SHEET, archive: S.ARCHIVED_DELIVERY_SHEET, col: "I", width: 9, folder: "Client Statements", label: "Client", key: (r: string[]) => [r[8], r[0], r[4], r[5], r[6]] },
      partner: { active: S.OUTSOURCE_SHEET, archive: S.ARCHIVED_OUTSOURCE_SHEET, col: "F", width: 6, folder: "Outsourcing Reports", label: "Partner", key: (r: string[]) => [r[5], r[1], r[2], r[3], r[4]] },
      transport: { active: S.TRANSPORT_SHEET, archive: S.ARCHIVED_TRANSPORT_SHEET, col: "I", width: 9, folder: "Transport Statements", label: "Transport", key: (r: string[]) => [r[8], r[1], r[2], r[3], r[4], r[5], r[6]] },
    }[data.kind];
    const { active, archive } = cfg;
    await S.ensureSheet(active);
    const rows = await S.readRange(`${active}!A2:${cfg.col}`);
    const keyOf = (r: string[]) => cfg.key(r).map((v) => v ?? "").join("|");
    const wanted = new Set(data.keys);
    const moving = rows.filter((r) => wanted.has(keyOf(r)));
    if (moving.length !== data.keys.length)
      throw new Error("Some rows changed since the preview. Refresh and try again.");

    const file = await uploadPdf(
      cfg.folder,
      data.fileName,
      data.pdfBase64,
    );
    const now = new Date().toISOString();
    const id = `ST-${now.replace(/[-:TZ.]/g, "").slice(0, 14)}`;
    const width = cfg.width;
    const pad = (r: string[]) => Array.from({ length: width }, (_, i) => r[i] ?? "");
    await S.ensureSheet(archive);
    await S.appendRows(archive, moving.map((r) => [...pad(r), now, id]));
    await S.rewriteRows(active, rows.filter((r) => !wanted.has(keyOf(r))).map(pad));

    // Client statements also clear the intake: once every delivery row of a
    // client voucher has been archived (this statement covered them all) and
    // the voucher is fully delivered (or manually marked), its ClientVouchers
    // rows move to ArchivedClientVouchers and leave the active tab.
    if (data.kind === "client") {
      const isBase = (p: string | undefined) => {
        const t = (p ?? "").trim().toLowerCase();
        return t === "" || t === "finishing" || t === "return";
      };
      const toNum = (v: string | undefined) => {
        const n = Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
        return Number.isFinite(n) ? n : 0;
      };
      const cRows = await S.readRange(`${S.CLIENT_SHEET}!A2:I`);
      const stillActive = rows.filter((r) => !wanted.has(keyOf(r)));
      const archivedReads = await S.batchRead([`${S.ARCHIVED_DELIVERY_SHEET}!A2:K`]);
      const archivedDeliveries = archivedReads[0] ?? [];
      const allDeliveries = [...stillActive, ...archivedDeliveries];
      const cPad = (r: string[]) => Array.from({ length: 9 }, (_, i) => r[i] ?? "");

      const groups = new Map<string, { rows: string[][] }>();
      for (const r of cRows) {
        const vk = (r[0] ?? "").trim().toLowerCase();
        if (!vk) continue;
        const g = groups.get(vk) ?? { rows: [] };
        g.rows.push(r);
        groups.set(vk, g);
      }
      const activeLeft = new Set(stillActive.map((r) => (r[1] ?? "").trim().toLowerCase()));
      const clearVouchers: string[] = [];
      for (const [vk, g] of groups) {
        if (activeLeft.has(vk)) continue; // some deliveries not in this statement yet
        const completed = g.rows.some((r) => (r[8] ?? "").trim().toLowerCase() === "yes");
        if (!completed) {
          const single = g.rows.length === 1;
          const orderedByItem = new Map<string, number>();
          for (const r of g.rows) {
            const ik = (r[3] ?? "").trim().toLowerCase();
            const k = single && !ik ? "" : ik;
            orderedByItem.set(k, (orderedByItem.get(k) ?? 0) + toNum(r[5]));
          }
          const deliveredByItem = new Map<string, number>();
          for (const d of allDeliveries) {
            if ((d[1] ?? "").trim().toLowerCase() !== vk || !isBase(d[5])) continue;
            const ik = (d[4] ?? "").trim().toLowerCase();
            const k = single && !ik ? "" : ik;
            deliveredByItem.set(k, (deliveredByItem.get(k) ?? 0) + toNum(d[6]));
          }
          const fully = [...orderedByItem].every(
            ([k, ordered]) => (deliveredByItem.get(k) ?? 0) >= ordered,
          );
          if (!fully) continue;
        }
        clearVouchers.push(vk);
      }
      if (clearVouchers.length) {
        const keep = cRows.filter(
          (r) => !clearVouchers.includes((r[0] ?? "").trim().toLowerCase()),
        );
        const clearing = cRows.filter((r) =>
          clearVouchers.includes((r[0] ?? "").trim().toLowerCase()),
        );
        await S.ensureSheet(S.ARCHIVED_CLIENT_SHEET);
        await S.appendRows(
          S.ARCHIVED_CLIENT_SHEET,
          clearing.map((r) => [...cPad(r), now, id]),
        );
        await S.rewriteRows(S.CLIENT_SHEET, keep.map(cPad));
      }
    }

    await S.ensureSheet(S.HISTORY_SHEET);
    await S.appendRows(S.HISTORY_SHEET, [
      [id, cfg.label, data.fileName.replace(/\.pdf$/i, "") || data.name, data.from, data.to, String(moving.length), String(data.total), file.id, file.webViewLink, now],
    ]);
    invalidateBoard();
    return { id, url: file.webViewLink };
  });

// ============= Masters (Options sheet) =============

const OPTION_TYPES = ["client", "item", "dprocess", "process", "partner", "transporter"] as const;
const optionSchema = z.object({
  type: z.enum(OPTION_TYPES),
  value: z.string().min(1).max(100),
  /** When set (and different), the existing value is renamed to this. */
  newValue: z.string().max(100).optional(),
});

/** Add a masters entry, or rename one when newValue is given. */
export const saveOption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAllowed])
  .inputValidator((d: unknown) => optionSchema.parse(d))
  .handler(async ({ data }) => {
    const S = await import("./sheets.server");
    await S.ensureSheet(S.OPTIONS_SHEET);
    const rows = await S.readRange(`${S.OPTIONS_SHEET}!A2:B`);
    const pad = (r: string[]) => [r[0] ?? "", r[1] ?? ""];
    const norm = (v: string | undefined) => (v ?? "").trim().toLowerCase();
    const nv = (data.newValue ?? "").trim();
    if (nv && norm(data.newValue ?? "") !== norm(data.value)) {
      const old = norm(data.value);
      let hit = false;
      const updated = rows.map((r) => {
        const p = pad(r);
        if (norm(p[0]) === data.type && norm(p[1]) === old) {
          hit = true;
          return [data.type, nv];
        }
        return p;
      });
      if (!hit) updated.push([data.type, nv]);
      await S.rewriteRows(S.OPTIONS_SHEET, updated);
      invalidateBoard();
      return { ok: true };
    }
    const exists = rows.some((r) => norm(r[0]) === data.type && norm(r[1]) === norm(data.value));
    if (exists) return { ok: true };
    await S.appendRows(S.OPTIONS_SHEET, [[data.type, data.value.trim()]]);
    invalidateBoard();
    return { ok: true };
  });

export const deleteOption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAllowed])
  .inputValidator((d: unknown) =>
    z.object({ type: z.enum(OPTION_TYPES), value: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    const S = await import("./sheets.server");
    const rows = await S.readRange(`${S.OPTIONS_SHEET}!A2:B`);
    const norm = (v: string | undefined) => (v ?? "").trim().toLowerCase();
    const kept = rows.filter(
      (r) => !(norm(r[0]) === data.type && norm(r[1]) === norm(data.value)),
    );
    if (kept.length === rows.length) return { ok: true };
    await S.rewriteRows(S.OPTIONS_SHEET, kept.map((r) => [r[0] ?? "", r[1] ?? ""]));
    invalidateBoard();
    return { ok: true };
  });

// ============= Business identity (system-wide) =============

export const saveBusiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAllowed])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().min(1).max(120),
        subtitle: z.string().max(120).default(""),
        location: z.string().max(120).default(""),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const S = await import("./sheets.server");
    await S.ensureSheet(S.OPTIONS_SHEET);
    const rows = await S.readRange(`${S.OPTIONS_SHEET}!A2:B`);
    const norm = (v: string | undefined) => (v ?? "").trim().toLowerCase();
    const entries: [string, string][] = [
      ["business_name", data.name.trim()],
      ["business_subtitle", data.subtitle.trim()],
      ["business_location", data.location.trim()],
    ];
    const updated = rows.map((r) => {
      const t = norm(r[0]);
      const hit = entries.find(([type]) => type === t);
      return hit ? [hit[0], hit[1]] : [r[0] ?? "", r[1] ?? ""];
    });
    for (const [type, value] of entries) {
      if (!updated.some((r) => norm(r[0]) === type)) updated.push([type, value]);
    }
    await S.rewriteRows(S.OPTIONS_SHEET, updated);
    invalidateBoard();
    return { ok: true };
  });

// ============= Edit / delete: client vouchers =============

const editClientSchema = z.object({
  voucherNo: z.string().min(1),
  clientName: z.string().min(1),
  date: z.string().min(1),
  notes: z.string().max(500).default(""),
  items: z.array(z.object({ item: z.string().min(1), quantity: z.string().min(1) })).min(1),
});

const toNum = (v: string | undefined) => {
  const n = Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const isBase = (p: string | undefined) => {
  const t = (p ?? "").trim().toLowerCase();
  return t === "" || t === "finishing" || t === "return";
};
const padW = (r: readonly (string | undefined)[], w: number): string[] =>
  Array.from({ length: w }, (_, i) => r[i] ?? "");

export const editClientVoucher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAllowed])
  .inputValidator((d: unknown) => editClientSchema.parse(d))
  .handler(async ({ data }) => {
    const S = await import("./sheets.server");
    const key = data.voucherNo.trim().toLowerCase();
    const rows = await S.readRange(`${S.CLIENT_SHEET}!A2:I`);
    const mine = rows.filter((r) => (r[0] ?? "").trim().toLowerCase() === key);
    if (!mine.length) throw new Error(`Client voucher ${data.voucherNo} not found.`);
    const seen = new Set<string>();
    for (const i of data.items) {
      const ik = i.item.trim().toLowerCase();
      if (seen.has(ik)) throw new Error("Each item can only be listed once.");
      seen.add(ik);
      if (toNum(i.quantity) <= 0) throw new Error("Quantities must be greater than 0.");
    }
    const [activeRows, archivedRows] = await Promise.all([
      S.readRange(`${S.DELIVERY_SHEET}!A2:G`),
      S.readSheet(S.ARCHIVED_DELIVERY_SHEET, "G"),
    ]);
    for (const i of data.items) {
      const ik = i.item.trim().toLowerCase();
      const single = data.items.length === 1;
      const delivered = [...activeRows, ...archivedRows]
        .filter((r) => (r[1] ?? "").trim().toLowerCase() === key && isBase(r[5]))
        .filter((r) => {
          const di = (r[4] ?? "").trim().toLowerCase();
          return di === ik || (single && di === "");
        })
        .reduce((s, r) => s + toNum(r[6]), 0);
      if (delivered > toNum(i.quantity))
        throw new Error(
          `${i.item}: ${delivered} already delivered — the new quantity cannot be lower.`,
        );
    }
    const first = mine[0] ?? [];
    const createdAt = first[7] || new Date().toISOString();
    const completed = (first[8] ?? "").trim().toLowerCase() === "yes" ? "yes" : "";
    const newRows = data.items.map((i) => [
      data.voucherNo,
      data.clientName,
      data.date,
      i.item,
      "",
      i.quantity,
      data.notes,
      createdAt,
      completed,
    ]);
    const updated = [
      ...rows.filter((r) => (r[0] ?? "").trim().toLowerCase() !== key).map((r) => padW(r, 9)),
      ...newRows,
    ];
    await S.rewriteRows(S.CLIENT_SHEET, updated);
    invalidateBoard();
    return { ok: true };
  });

export const deleteClientVoucher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAllowed])
  .inputValidator((d: unknown) => z.object({ voucherNo: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const S = await import("./sheets.server");
    const key = data.voucherNo.trim().toLowerCase();
    const rows = await S.readRange(`${S.CLIENT_SHEET}!A2:I`);
    const mine = rows.filter((r) => (r[0] ?? "").trim().toLowerCase() === key);
    if (!mine.length) throw new Error(`Client voucher ${data.voucherNo} not found.`);
    const active = await S.readRange(`${S.DELIVERY_SHEET}!A2:B`);
    if (active.some((r) => (r[1] ?? "").trim().toLowerCase() === key))
      throw new Error("Delete this voucher's delivery vouchers first.");
    await S.rewriteRows(
      S.CLIENT_SHEET,
      rows.filter((r) => (r[0] ?? "").trim().toLowerCase() !== key).map((r) => padW(r, 9)),
    );
    invalidateBoard();
    return { ok: true };
  });

// ============= Edit / delete: delivery rows =============

const editDeliverySchema = z.object({
  key: z.string().min(1),
  deliveryNo: z.string().min(1),
  date: z.string().min(1),
  notes: z.string().max(500).default(""),
  quantity: z.string().min(1),
});

const deliveryRowKey = (r: string[]) =>
  [r[8], r[0], r[4], r[5], r[6]].map((v) => v ?? "").join("|");

export const editDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAllowed])
  .inputValidator((d: unknown) => editDeliverySchema.parse(d))
  .handler(async ({ data }) => {
    const S = await import("./sheets.server");
    const rows = await S.readRange(`${S.DELIVERY_SHEET}!A2:I`);
    const idx = rows.findIndex((r) => deliveryRowKey(padW(r, 9)) === data.key);
    if (idx < 0)
      throw new Error("This delivery row changed or no longer exists. Refresh and try again.");
    if (toNum(data.quantity) <= 0) throw new Error("Quantity must be greater than 0.");
    const row = padW(rows[idx] ?? [], 9);
    const vk = (row[1] ?? "").trim().toLowerCase();
    const ik = (row[4] ?? "").trim().toLowerCase();
    if (isBase(row[5])) {
      const [cRows, activeRows, archivedRows] = await Promise.all([
        S.readRange(`${S.CLIENT_SHEET}!A2:F`),
        S.readRange(`${S.DELIVERY_SHEET}!A2:G`),
        S.readSheet(S.ARCHIVED_DELIVERY_SHEET, "G"),
      ]);
      const srcRows = cRows.filter((r) => (r[0] ?? "").trim().toLowerCase() === vk);
      if (srcRows.length) {
        const single = srcRows.length === 1;
        const ordered = srcRows
          .filter((r) => {
            const ci = (r[3] ?? "").trim().toLowerCase();
            return ci === ik || (single && ci === "");
          })
          .reduce((s, r) => s + toNum(r[5]), 0);
        const others = [
          ...activeRows.filter((_, i) => i !== idx),
          ...archivedRows,
        ]
          .filter((r) => (r[1] ?? "").trim().toLowerCase() === vk && isBase(r[5]))
          .filter((r) => {
            const di = (r[4] ?? "").trim().toLowerCase();
            return di === ik || (single && di === "");
          })
          .reduce((s, r) => s + toNum(r[6]), 0);
        if (toNum(data.quantity) + others > ordered)
          throw new Error(
            `Only ${Math.max(0, ordered - others)} left to deliver on voucher ${row[1]}.`,
          );
      }
    }
    const newRow = [
      data.deliveryNo,
      row[1] ?? "",
      row[2] ?? "",
      data.date,
      row[4] ?? "",
      row[5] ?? "",
      data.quantity,
      data.notes,
      row[8] ?? "",
    ];
    await S.rewriteRows(
      S.DELIVERY_SHEET,
      rows.map((r, i) => (i === idx ? newRow : padW(r, 9))),
    );
    invalidateBoard();
    return { ok: true };
  });

export const deleteDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAllowed])
  .inputValidator((d: unknown) => z.object({ key: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const S = await import("./sheets.server");
    const rows = await S.readRange(`${S.DELIVERY_SHEET}!A2:I`);
    const kept = rows.filter((r) => deliveryRowKey(padW(r, 9)) !== data.key);
    if (kept.length === rows.length)
      throw new Error("This delivery row changed or no longer exists. Refresh and try again.");
    await S.rewriteRows(S.DELIVERY_SHEET, kept.map((r) => padW(r, 9)));
    invalidateBoard();
    return { ok: true };
  });

// ============= Edit / delete: outsourcing rows =============

const editOutsourceSchema = z.object({
  key: z.string().min(1),
  date: z.string().min(1),
  partner: z.string().trim().min(1).max(100),
  party: z.string().trim().min(1).max(100),
  process: z.string().trim().min(1).max(100),
  quantity: z.string().regex(/^[0-9]+$/),
});

const outsourceRowKey = (r: string[]) =>
  [r[5], r[1], r[2], r[3], r[4]].map((v) => v ?? "").join("|");

export const editOutsourcingEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAllowed])
  .inputValidator((d: unknown) => editOutsourceSchema.parse(d))
  .handler(async ({ data }) => {
    const S = await import("./sheets.server");
    if (toNum(data.quantity) <= 0) throw new Error("Quantity must be greater than 0.");
    const rows = await S.readRange(`${S.OUTSOURCE_SHEET}!A2:F`);
    const idx = rows.findIndex((r) => outsourceRowKey(padW(r, 6)) === data.key);
    if (idx < 0)
      throw new Error("This entry changed or no longer exists. Refresh and try again.");
    const createdAt = padW(rows[idx] ?? [], 6)[5];
    const newRow = [data.date, data.partner, data.party, data.process, data.quantity, createdAt];
    await S.rewriteRows(
      S.OUTSOURCE_SHEET,
      rows.map((r, i) => (i === idx ? newRow : padW(r, 6))),
    );
    invalidateBoard();
    return { ok: true };
  });

export const deleteOutsourcingEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAllowed])
  .inputValidator((d: unknown) => z.object({ key: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const S = await import("./sheets.server");
    const rows = await S.readRange(`${S.OUTSOURCE_SHEET}!A2:F`);
    const kept = rows.filter((r) => outsourceRowKey(padW(r, 6)) !== data.key);
    if (kept.length === rows.length)
      throw new Error("This entry changed or no longer exists. Refresh and try again.");
    await S.rewriteRows(S.OUTSOURCE_SHEET, kept.map((r) => padW(r, 6)));
    invalidateBoard();
    return { ok: true };
  });

// ============= Edit / delete: transport rows =============

const editTransportSchema = z.object({
  key: z.string().min(1),
  date: z.string().min(1),
  partner: z.string().trim().min(1).max(100),
  client: z.string().trim().min(1).max(100),
  direction: z.enum(["Inwards", "Outwards"]),
  boxes: z.string().regex(/^[0-9]*$/).default(""),
  bags: z.string().regex(/^[0-9]*$/).default(""),
  covers: z.string().regex(/^[0-9]*$/).default(""),
  notes: z.string().max(500).default(""),
});

const transportRowKey = (r: string[]) =>
  [r[8], r[1], r[2], r[3], r[4], r[5], r[6]].map((v) => v ?? "").join("|");

export const editTransportEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAllowed])
  .inputValidator((d: unknown) => editTransportSchema.parse(d))
  .handler(async ({ data }) => {
    const S = await import("./sheets.server");
    const total = toNum(data.boxes) + toNum(data.bags) + toNum(data.covers);
    if (total <= 0) throw new Error("Enter at least one box, bag or cover.");
    const rows = await S.readRange(`${S.TRANSPORT_SHEET}!A2:I`);
    const idx = rows.findIndex((r) => transportRowKey(padW(r, 9)) === data.key);
    if (idx < 0)
      throw new Error("This entry changed or no longer exists. Refresh and try again.");
    const createdAt = padW(rows[idx] ?? [], 9)[8];
    const newRow = [
      data.date,
      data.partner,
      data.client,
      data.direction,
      data.boxes,
      data.bags,
      data.covers,
      data.notes,
      createdAt,
    ];
    await S.rewriteRows(
      S.TRANSPORT_SHEET,
      rows.map((r, i) => (i === idx ? newRow : padW(r, 9))),
    );
    invalidateBoard();
    return { ok: true };
  });

export const deleteTransportEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAllowed])
  .inputValidator((d: unknown) => z.object({ key: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const S = await import("./sheets.server");
    const rows = await S.readRange(`${S.TRANSPORT_SHEET}!A2:I`);
    const kept = rows.filter((r) => transportRowKey(padW(r, 9)) !== data.key);
    if (kept.length === rows.length)
      throw new Error("This entry changed or no longer exists. Refresh and try again.");
    await S.rewriteRows(S.TRANSPORT_SHEET, kept.map((r) => padW(r, 9)));
    invalidateBoard();
    return { ok: true };
  });
