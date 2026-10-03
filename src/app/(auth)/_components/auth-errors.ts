interface AuthErrorLike {
  code?: string | undefined;
  message?: string | undefined;
  status?: number | undefined;
}

// pesan kode ini sudah Bahasa Indonesia dari hook server, termasuk sisa menit kunci
const SERVER_MESSAGE_CODES = new Set(["LOGIN_LOCKED", "INVALID_EMAIL_OR_PASSWORD"]);

export const INVALID_CREDENTIALS = "Email atau password salah. Cek lagi lalu coba lagi.";
export const EMPTY_FIELDS = "Isi email dan password untuk masuk.";
export const NETWORK_ERROR = "Tidak bisa masuk sekarang. Periksa koneksi lalu coba lagi.";
const TOO_MANY = "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.";

export function authErrorMessage(error: AuthErrorLike | null | undefined): string {
  const code = error?.code ?? "";
  if (SERVER_MESSAGE_CODES.has(code) && error?.message) return error.message;
  if (error?.status === 401) return INVALID_CREDENTIALS;
  if (error?.status === 429) return TOO_MANY;
  return NETWORK_ERROR;
}

export function safeNextPath(next: string | undefined | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}
