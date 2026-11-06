export type PendingTask =
  | { kind: "client"; data: { voucherNo: string; clientName: string; date: string; notes: string; items: { item: string; quantity: string }[] } }
  | { kind: "delivery"; data: { deliveryNo: string; clientVoucherNo: string; clientName: string; date: string; notes: string; lines: { item: string; process: string; quantity: string }[] } }
  | { kind: "completed"; data: { voucherNo: string; completed: boolean } }
  | { kind: "outsourcing"; data: { date: string; partner: string; party: string; process: string; quantity: string; newPartner: boolean; newProcess: boolean } }
  | { kind: "transport"; data: { date: string; partner: string; client: string; direction: "Inwards" | "Outwards"; boxes: string; bags: string; covers: string; notes: string; newPartner: boolean } };

type StoredTask = PendingTask & { id: number };
const DB_NAME = "msulaim-offline";
const STORE = "outbox";
const CHANGE_EVENT = "msulaim-outbox-change";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Offline storage is unavailable."));
  });
}

export async function enqueue(task: PendingTask): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).add(task);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not save this entry offline."));
  });
  db.close();
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export async function listPending(): Promise<StoredTask[]> {
  const db = await openDb();
  const rows = await new Promise<StoredTask[]>((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result as StoredTask[]);
    request.onerror = () => reject(request.error ?? new Error("Could not read offline entries."));
  });
  db.close();
  return rows.sort((a, b) => a.id - b.id);
}

export async function removePending(id: number): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not clear the synced entry."));
  });
  db.close();
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export async function pendingCount(): Promise<number> {
  const db = await openDb();
  const count = await new Promise<number>((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not read offline entries."));
  });
  db.close();
  return count;
}

export const outboxChangeEvent = CHANGE_EVENT;