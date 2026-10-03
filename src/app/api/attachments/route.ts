import { UploadError } from "@/server/attachments/image";
import { storeUploadedImage } from "@/server/attachments/upload";
import { getViewerFromHeaders } from "@/server/auth/session";
import { toActionError } from "@/server/actions/result";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEADERS = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

function json(status: number, body: unknown): Response {
  return Response.json(body, { status, headers: HEADERS });
}

// route handler tidak dapat cek origin bawaan server action; tolak kiriman lintas situs
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === (request.headers.get("x-forwarded-host") ?? request.headers.get("host"));
  } catch {
    return false;
  }
}

/** Unggah foto struk atau lampiran (body = byte gambar). `?transaksi=<id>` langsung menautkan ke transaksi. */
export async function POST(request: Request): Promise<Response> {
  const viewer = await getViewerFromHeaders(request.headers);
  if (!viewer) return json(401, { error: "Sesimu berakhir. Masuk lagi untuk melanjutkan." });
  if (!sameOrigin(request)) return json(403, { error: "Permintaan ditolak." });
  const transactionId = new URL(request.url).searchParams.get("transaksi");
  if (transactionId !== null && !UUID.test(transactionId)) return json(400, { error: "Transaksi ini tidak ditemukan, mungkin sudah dihapus. Muat ulang halaman lalu coba lagi." });
  try {
    const stored = await storeUploadedImage(viewer, request, { transactionId });
    return json(201, stored);
  } catch (e) {
    if (e instanceof UploadError) return json(e.status, { error: e.message });
    const error = toActionError(e);
    return json(error.code === "not_found" ? 404 : error.code === "internal" ? 500 : 400, { error: error.error });
  }
}
