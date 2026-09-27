import type { Board, ClientVoucher, DeliveryVoucher } from "./vouchers.functions";

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
  const delivered = linked.reduce((sum, d) => sum + num(d.quantity), 0);
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
