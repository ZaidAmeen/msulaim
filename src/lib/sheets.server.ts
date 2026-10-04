const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";

export const SPREADSHEET_ID = "1yLFmfICO0cU7qnKAqIK8jWVeVamx1InRt1NGTkr-ccc";
export const CLIENT_SHEET = "ClientVouchers";
export const DELIVERY_SHEET = "DeliveryVouchers";

function headers() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connKey = process.env["GOOGLE_SHEETS_API_KEY"];
  if (!lovableKey || !connKey) {
    throw new Error("Google Sheets is not connected yet.");
  }
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": connKey,
    "Content-Type": "application/json",
  };
}

async function handle(res: Response) {
  if (!res.ok) {
    const body = await res.text();
    console.error(`Sheets request failed [${res.status}]: ${body}`);
    throw new Error(`Google Sheets request failed [${res.status}]: ${body}`);
  }
  return res.json();
}

export async function readRange(range: string): Promise<string[][]> {
  const res = await fetch(
    `${GATEWAY}/spreadsheets/${SPREADSHEET_ID}/values/${range}?valueRenderOption=FORMATTED_VALUE`,
    { headers: headers() },
  );
  const json = (await handle(res)) as { values?: unknown[][] };
  return (json.values ?? []).map((row) => row.map((cell) => (cell == null ? "" : String(cell))));
}

export async function appendRow(sheet: string, values: (string | number)[]) {
  const res = await fetch(
    `${GATEWAY}/spreadsheets/${SPREADSHEET_ID}/values/${sheet}!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { method: "POST", headers: headers(), body: JSON.stringify({ values: [values] }) },
  );
  return handle(res);
}

export async function appendRows(sheet: string, rows: (string | number)[][]) {
  const res = await fetch(
    `${GATEWAY}/spreadsheets/${SPREADSHEET_ID}/values/${sheet}!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { method: "POST", headers: headers(), body: JSON.stringify({ values: rows }) },
  );
  return handle(res);
}

export const ARCHIVED_DELIVERY_SHEET = "ArchivedDeliveryVouchers";
export const OUTSOURCE_SHEET = "Outsourcing";
export const ARCHIVED_OUTSOURCE_SHEET = "ArchivedOutsourcing";
export const HISTORY_SHEET = "StatementHistory";
export const OPTIONS_SHEET = "Options";

export const SHEET_HEADERS: Record<string, string[]> = {
  [ARCHIVED_DELIVERY_SHEET]: ["Delivery No", "Client Voucher No", "Client", "Date", "Item", "Process", "Quantity", "Notes", "Created At", "Archived At", "Statement ID"],
  [OUTSOURCE_SHEET]: ["Date", "Partner", "Party", "Process", "Quantity", "Created At"],
  [ARCHIVED_OUTSOURCE_SHEET]: ["Date", "Partner", "Party", "Process", "Quantity", "Created At", "Archived At", "Statement ID"],
  [HISTORY_SHEET]: ["Statement ID", "Type", "Name", "From", "To", "Rows", "Total Quantity", "Drive File ID", "Drive URL", "Created At"],
  [OPTIONS_SHEET]: ["Type", "Value"],
};

let knownSheets: Set<string> | null = null;

/** Create the tab (with header row) if it does not exist yet. */
export async function ensureSheet(name: string) {
  if (!knownSheets || !knownSheets.has(name)) {
    const res = await fetch(
      `${GATEWAY}/spreadsheets/${SPREADSHEET_ID}?fields=sheets.properties.title`,
      { headers: headers() },
    );
    const json = (await handle(res)) as { sheets?: { properties: { title: string } }[] };
    knownSheets = new Set((json.sheets ?? []).map((s) => s.properties.title));
  }
  if (knownSheets.has(name)) return;
  await handle(
    await fetch(`${GATEWAY}/spreadsheets/${SPREADSHEET_ID}:batchUpdate`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: name } } }] }),
    }),
  );
  knownSheets.add(name);
  const header = SHEET_HEADERS[name];
  if (header) {
    await handle(
      await fetch(
        `${GATEWAY}/spreadsheets/${SPREADSHEET_ID}/values/${name}!A1?valueInputOption=RAW`,
        { method: "PUT", headers: headers(), body: JSON.stringify({ values: [header] }) },
      ),
    );
  }
}

/** Read a tab that may not exist yet (returns [] when missing). */
export async function readSheet(name: string, cols: string): Promise<string[][]> {
  await ensureSheet(name);
  return readRange(`${name}!A2:${cols}`);
}

/** Replace all data rows (below the header) of a tab. */
export async function rewriteRows(sheet: string, rows: string[][]) {
  await handle(
    await fetch(`${GATEWAY}/spreadsheets/${SPREADSHEET_ID}/values/${sheet}!A2:Z:clear`, {
      method: "POST",
      headers: headers(),
      body: "{}",
    }),
  );
  if (!rows.length) return;
  await handle(
    await fetch(
      `${GATEWAY}/spreadsheets/${SPREADSHEET_ID}/values/${sheet}!A2?valueInputOption=RAW`,
      { method: "PUT", headers: headers(), body: JSON.stringify({ values: rows }) },
    ),
  );
}
