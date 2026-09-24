import { REMEMBER_DEVICE_COOKIE, REMEMBER_DEVICE_COOKIE_MAX_AGE_SECONDS } from "@/server/auth/constants";

interface AuthErrorLike {
  code?: string | undefined;
  message?: string | undefined;
  status?: number | undefined;
}

// kode yang pesannya sudah Bahasa Indonesia dari server dipakai apa adanya
const SERVER_MESSAGE_CODES = new Set(["LOGIN_LOCKED", "INVALID_EMAIL_OR_PASSWORD", "INVALID_CODE", "ENROLLMENT_INVALID"]);

const MESSAGES: Record<string, string> = {
  AUTH_CANCELLED: "Masuk dengan passkey dibatalkan. Coba lagi atau pakai password.",
  ERROR_CEREMONY_ABORTED: "Pendaftaran passkey dibatalkan. Coba lagi.",
  REGISTRATION_CANCELLED: "Pendaftaran passkey dibatalkan. Coba lagi.",
  ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED: "Passkey ini sudah terdaftar di akunmu.",
  PREVIOUSLY_REGISTERED: "Passkey ini sudah terdaftar di akunmu.",
  PASSKEY_NOT_FOUND: "Passkey ini belum terdaftar. Pakai password, atau minta tautan pendaftaran baru.",
  AUTHENTICATION_FAILED: "Passkey tidak bisa diverifikasi. Coba lagi.",
  CHALLENGE_NOT_FOUND: "Waktu verifikasi habis. Coba lagi.",
  INVALID_TWO_FACTOR_COOKIE: "Langkah verifikasi sudah kedaluwarsa. Masukkan email dan password lagi.",
  TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE: "Terlalu banyak kode salah. Masukkan email dan password lagi.",
  ACCOUNT_TEMPORARILY_LOCKED: "Terlalu banyak kode salah. Coba lagi dalam 15 menit.",
  TOO_MANY_REQUESTS: "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.",
};

export function authErrorMessage(error: AuthErrorLike | null | undefined): string {
  const code = error?.code ?? "";
  if (SERVER_MESSAGE_CODES.has(code) && error?.message) return error.message;
  if (MESSAGES[code]) return MESSAGES[code];
  if (error?.status === 429) return MESSAGES.TOO_MANY_REQUESTS ?? "";
  return "Tidak bisa masuk sekarang. Periksa koneksi lalu coba lagi.";
}

// dibaca hook sesi di server untuk menentukan masa berlaku 30 hari atau 12 jam
export function setRememberDevice(remember: boolean): void {
  const secure = window.location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${REMEMBER_DEVICE_COOKIE}=${remember ? "1" : "0"}; path=/; max-age=${REMEMBER_DEVICE_COOKIE_MAX_AGE_SECONDS}; samesite=lax${secure}`;
}

export function safeNextPath(next: string | undefined | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}
