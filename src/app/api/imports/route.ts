import { UploadError } from "@/server/attachments/image";
import { readLimited } from "@/server/attachments/upload";
import { toActionError } from "@/server/actions/result";
import { getViewerFromHeaders } from "@/server/auth/session";
import type { Viewer } from "@/server/auth/viewer";
import { handleImportFile, IMPORT_MAX_BYTES, IMPORT_UPLOAD_MESSAGES, type ImportUploadResponse } from "./dispatch";
import { AlreadyImportedError } from "@/server/import/pipeline";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEADERS = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
// ruang untuk batas multipart dan field teks di samping file 20 MB
const MULTIPART_OVERHEAD = 64 * 1024;

function json(status: number, body: ImportUploadResponse | { error: string; code: string; href?: string }): Response {
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

async function readForm(request: Request): Promise<FormData> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > IMPORT_MAX_BYTES + MULTIPART_OVERHEAD) throw new UploadError(413, IMPORT_UPLOAD_MESSAGES.tooLarge);
  let body: Buffer;
  try {
    body = await readLimited(request.body, IMPORT_MAX_BYTES + MULTIPART_OVERHEAD);
  } catch (e) {
    if (e instanceof UploadError) throw new UploadError(e.status, e.status === 413 ? IMPORT_UPLOAD_MESSAGES.tooLarge : IMPORT_UPLOAD_MESSAGES.empty);
    throw e;
  }
  try {
    return await new Response(new Uint8Array(body), { headers: { "content-type": request.headers.get("content-type") ?? "" } }).formData();
  } catch {
    throw new UploadError(400, IMPORT_UPLOAD_MESSAGES.empty);
  }
}

async function handle(viewer: Viewer, request: Request): Promise<Response> {
  const form = await readForm(request);
  const file = form.get("file");
  const accountId = form.get("accountId");
  const password = form.get("password");
  if (!(file instanceof File) || file.size === 0) return json(400, { error: IMPORT_UPLOAD_MESSAGES.empty, code: "empty" });
  if (typeof accountId !== "string" || accountId === "") return json(400, { error: IMPORT_UPLOAD_MESSAGES.noAccount, code: "validation" });
  const result = await handleImportFile(viewer, {
    accountId,
    name: file.name,
    bytes: new Uint8Array(await file.arrayBuffer()),
    // password PDF hanya diteruskan di memori; tidak pernah disimpan atau dicatat
    password: typeof password === "string" && password !== "" ? password : undefined,
    readWithAi: form.get("mode") === "ai",
  });
  return json(result.status === "unrecognized" ? 422 : 200, result);
}

/** Unggah mutasi (multipart: file, accountId, password?, mode?) untuk CSV maupun PDF. */
export async function POST(request: Request): Promise<Response> {
  const viewer = await getViewerFromHeaders(request.headers);
  if (!viewer) return json(401, { error: "Sesimu berakhir. Masuk lagi untuk melanjutkan.", code: "unauthorized" });
  if (!sameOrigin(request)) return json(403, { error: "Permintaan ditolak.", code: "forbidden" });
  try {
    return await handle(viewer, request);
  } catch (e) {
    if (e instanceof UploadError) return json(e.status, { error: e.message, code: e.status === 413 ? "too_large" : "invalid_file" });
    if (e instanceof AlreadyImportedError) return json(409, { error: e.message, code: e.code, href: `/impor/${e.batchId}` });
    const error = toActionError(e);
    return json(error.code === "not_found" ? 404 : error.code === "internal" ? 500 : 400, { error: error.error, code: error.code });
  }
}
