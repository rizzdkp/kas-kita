export const NETWORK_ERROR = "Tidak bisa terhubung ke server. Periksa koneksi lalu coba lagi.";
// sama dengan batas server (SECURITY.md); dicek di browser supaya file raksasa tidak sempat diunggah
export const IMPORT_MAX_BYTES = 20 * 1024 * 1024;
export const TOO_LARGE = "File lebih dari 20 MB. Unduh mutasi per bulan lalu unggah satu per satu.";

export type ImportUploadOutcome =
  | { kind: "next"; href: string }
  | { kind: "needs_password"; wrongPassword: boolean }
  | { kind: "unrecognized"; offerAi: boolean; error: string }
  | { kind: "error"; error: string; href: string | null };

type ResponseBody = {
  status?: unknown;
  next?: unknown;
  wrongPassword?: unknown;
  offerAi?: unknown;
  error?: unknown;
  href?: unknown;
};

function outcomeOf(status: number, body: ResponseBody): ImportUploadOutcome {
  if (status >= 200 && status < 300 && typeof body.next === "string") return { kind: "next", href: body.next };
  if (body.status === "needs_password") return { kind: "needs_password", wrongPassword: body.wrongPassword === true };
  if (body.status === "unrecognized") return { kind: "unrecognized", offerAi: body.offerAi === true, error: typeof body.error === "string" ? body.error : NETWORK_ERROR };
  return { kind: "error", error: typeof body.error === "string" ? body.error : NETWORK_ERROR, href: typeof body.href === "string" ? body.href : null };
}

export interface ImportUploadInput {
  accountId: string;
  file: File;
  /** Password PDF hanya dikirim di body request ini, tidak disimpan di browser. */
  password?: string;
  readWithAi?: boolean;
}

/** Unggah lewat XHR karena fetch belum memberi progres unggah di semua browser. */
export function uploadImportFile(input: ImportUploadInput, onProgress?: (fraction: number) => void): Promise<ImportUploadOutcome> {
  if (input.file.size > IMPORT_MAX_BYTES) return Promise.resolve({ kind: "error", error: TOO_LARGE, href: null });
  const form = new FormData();
  form.set("accountId", input.accountId);
  form.set("file", input.file);
  if (input.password) form.set("password", input.password);
  if (input.readWithAi) form.set("mode", "ai");
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/imports");
    xhr.responseType = "json";
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress?.(event.loaded / event.total);
    };
    xhr.onerror = () => resolve({ kind: "error", error: NETWORK_ERROR, href: null });
    xhr.onload = () => resolve(outcomeOf(xhr.status, (xhr.response ?? {}) as ResponseBody));
    xhr.send(form);
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("id-ID", { maximumFractionDigits: 1 })} MB`;
}
