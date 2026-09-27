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
