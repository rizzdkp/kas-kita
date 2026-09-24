import { readAttachmentFile } from "@/server/attachments/storage";
import { getViewerFromHeaders } from "@/server/auth/session";
import { getAttachment } from "@/server/queries/attachments";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(status: number, body: string): Response {
  return new Response(body, { status, headers: { "Cache-Control": "private, no-store", "Content-Type": "text/plain; charset=utf-8" } });
}

/** Sajikan lampiran hanya untuk sesi yang valid (SECURITY.md: lampiran diakses langsung). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const viewer = await getViewerFromHeaders(request.headers);
  if (!viewer) return text(401, "Sesimu berakhir. Masuk lagi untuk melanjutkan.");
  const { id } = await params;
  const row = UUID.test(id) ? await getAttachment(id) : null;
  const data = row ? await readAttachmentFile(row.storageKey) : null;
  if (!row || !data) return text(404, "Foto ini tidak ditemukan, mungkin sudah dihapus.");
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": row.mime,
      "Content-Length": String(data.length),
      // isi per id tidak pernah berubah, tetapi hanya boleh disimpan cache browser pengguna ini
      "Cache-Control": "private, max-age=3600",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
