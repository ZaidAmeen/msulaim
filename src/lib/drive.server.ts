const DRIVE = "https://connector-gateway.lovable.dev/google_drive";

function headers(extra: Record<string, string> = {}) {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connKey = process.env["GOOGLE_DRIVE_API_KEY"];
  if (!lovableKey || !connKey) throw new Error("Google Drive is not connected yet.");
  return { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": connKey, ...extra };
}

async function handle(res: Response) {
  if (!res.ok) {
    const body = await res.text();
    console.error(`Drive request failed [${res.status}]: ${body}`);
    throw new Error(`Google Drive request failed [${res.status}]: ${body}`);
  }
  return res.json();
}

async function findOrCreateFolder(name: string, parent?: string): Promise<string> {
  const q = [
    `name='${name.replace(/'/g, "\\'")}'`,
    "mimeType='application/vnd.google-apps.folder'",
    "trashed=false",
    parent ? `'${parent}' in parents` : "'root' in parents",
  ].join(" and ");
  const found = (await handle(
    await fetch(`${DRIVE}/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`, {
      headers: headers(),
    }),
  )) as { files: { id: string }[] };
  if (found.files?.[0]) return found.files[0].id;
  const created = (await handle(
    await fetch(`${DRIVE}/drive/v3/files?fields=id`, {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        name,
        mimeType: "application/vnd.google-apps.folder",
        ...(parent ? { parents: [parent] } : {}),
      }),
    }),
  )) as { id: string };
  return created.id;
}

/** Upload a PDF into "M Sulaim Documents/<subfolder>" and return its id + link. */
export async function uploadPdf(subfolder: string, fileName: string, base64: string) {
  const root = await findOrCreateFolder("M Sulaim Documents");
  const folder = await findOrCreateFolder(subfolder, root);
  const boundary = "msulaim" + Math.random().toString(36).slice(2);
  const meta = JSON.stringify({ name: fileName, parents: [folder], mimeType: "application/pdf" });
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
    `--${boundary}\r\nContent-Type: application/pdf\r\nContent-Transfer-Encoding: base64\r\n\r\n${base64}\r\n` +
    `--${boundary}--`;
  const file = (await handle(
    await fetch(`${DRIVE}/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink`, {
      method: "POST",
      headers: headers({ "Content-Type": `multipart/related; boundary=${boundary}` }),
      body,
    }),
  )) as { id: string; webViewLink: string };
  return file;
}
