import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { todayJakarta } from "@/lib/dates";
import { getViewerFromHeaders } from "@/server/auth/session";
import { exportHouseholdData, serializeExport } from "@/server/queries/settings";
import { zipStream, type ZipEntry } from "./zip";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AttachmentRow = { id: string; storageKey: string; deletedAt: Date | null };

// storage_key berasal dari database, tetapi tetap dicegah keluar dari folder lampiran
function attachmentPath(root: string, storageKey: string): string | null {
  const full = resolve(root, storageKey);
  return full.startsWith(resolve(root) + sep) ? full : null;
}

async function* exportEntries(json: string, attachments: AttachmentRow[]): AsyncGenerator<ZipEntry> {
  yield { name: "data.json", data: Buffer.from(json, "utf8"), compress: true };
  const root = process.env.ATTACHMENTS_DIR;
  const missing: string[] = [];
  for (const row of attachments) {
    if (row.deletedAt) continue;
    const path = root ? attachmentPath(root, row.storageKey) : null;
    const data = path ? await readFile(path).catch(() => null) : null;
    if (!data) {
      missing.push(row.id);
      continue;
    }
    yield { name: `lampiran/${row.storageKey}`, data, compress: false };
  }
  if (missing.length > 0) {
    const note = JSON.stringify({ message: "Lampiran ini tidak ditemukan di penyimpanan saat ekspor.", attachmentIds: missing }, null, 2);
    yield { name: "lampiran-tidak-ditemukan.json", data: Buffer.from(note, "utf8"), compress: true };
  }
}

/** Ekspor semua data rumah tangga (F-SET-1): data.json + folder lampiran dalam satu zip. */
export async function GET(request: Request): Promise<Response> {
  const viewer = await getViewerFromHeaders(request.headers);
  if (!viewer) {
    return new Response("Sesimu berakhir. Masuk lagi untuk melanjutkan.", {
      status: 401,
      headers: { "Cache-Control": "private, no-store", "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  const data = await exportHouseholdData(viewer);
  const attachments = data.tables.attachments as AttachmentRow[];
  const filename = `kas-kita-${todayJakarta()}.zip`;
  return new Response(zipStream(exportEntries(serializeExport(data), attachments)), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
