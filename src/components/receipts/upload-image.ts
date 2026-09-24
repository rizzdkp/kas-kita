export const NETWORK_ERROR = "Tidak bisa terhubung ke server. Periksa koneksi lalu coba lagi.";

export type UploadImageResult = { ok: true; id: string } | { ok: false; error: string };

/** Unggah lewat XHR karena fetch belum memberi progres unggah di semua browser. */
export function uploadImage(
  blob: Blob,
  opts: { transactionId?: string; onProgress?: (fraction: number) => void } = {},
): Promise<UploadImageResult> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    const query = opts.transactionId ? `?transaksi=${encodeURIComponent(opts.transactionId)}` : "";
    xhr.open("POST", `/api/attachments${query}`);
    xhr.setRequestHeader("Content-Type", blob.type || "application/octet-stream");
    xhr.responseType = "json";
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) opts.onProgress?.(event.loaded / event.total);
    };
    xhr.onerror = () => resolve({ ok: false, error: NETWORK_ERROR });
    xhr.onload = () => {
      const body = (xhr.response ?? {}) as { id?: unknown; error?: unknown };
      if (xhr.status >= 200 && xhr.status < 300 && typeof body.id === "string") {
        opts.onProgress?.(1);
        resolve({ ok: true, id: body.id });
        return;
      }
      resolve({ ok: false, error: typeof body.error === "string" ? body.error : NETWORK_ERROR });
    };
    xhr.send(blob);
  });
}

export function attachmentUrl(id: string): string {
  return `/api/attachments/${id}`;
}
