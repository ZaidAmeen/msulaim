import type { Board, ClientVoucher, DeliveryVoucher } from "./vouchers.functions";
import { isBaseProcess } from "./options";

export function deliveriesFor(board: Board, voucherNo: string): DeliveryVoucher[] {
  return board.deliveryVouchers.filter(
    (d) => d.clientVoucherNo.trim().toLowerCase() === voucherNo.trim().toLowerCase(),
  );
}

export function num(value: string): number {
  const n = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export type Status = "linked" | "partial" | "pending";

export function statusOf(board: Board, v: ClientVoucher): Status {
  const linked = deliveriesFor(board, v.voucherNo);
  if (linked.length === 0) return "pending";
  const ordered = num(v.quantity);
  const delivered = baseDelivered(board, v.voucherNo);
  if (ordered > 0 && delivered < ordered) return "partial";
  return "linked";
}

export function monthKey(date: string): string {
  const d = new Date(date);
  if (!Number.isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  return "unknown";
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  if (!y || !m) return key;
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

/** Physical sarees delivered (Finishing + Return; untagged legacy rows count too). */
export function baseDelivered(board: Board, voucherNo: string): number {
  return deliveriesFor(board, voucherNo)
    .filter((d) => isBaseProcess(d.process))
    .reduce((s, d) => s + num(d.quantity), 0);
}

/** Physical sarees delivered for one item of a voucher. */
export function itemDelivered(board: Board, v: ClientVoucher, item: string): number {
  const ik = item.trim().toLowerCase();
  const single = v.items.length === 1;
  return deliveriesFor(board, v.voucherNo)
    .filter((d) => isBaseProcess(d.process))
    .filter((d) => {
      const di = d.item.trim().toLowerCase();
      return di === ik || (single && di === "");
    })
    .reduce((s, d) => s + num(d.quantity), 0);
}

/** Items on a voucher with ordered / delivered / remaining counts. */
export function itemStatus(board: Board, v: ClientVoucher) {
  return v.items.map((i) => {
    const ordered = num(i.quantity);
    const delivered = itemDelivered(board, v, i.item);
    return { item: i.item, ordered, delivered, remaining: Math.max(0, ordered - delivered) };
  });
}
