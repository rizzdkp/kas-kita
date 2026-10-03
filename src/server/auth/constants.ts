// modul ini tanpa dependensi server supaya bisa dipakai middleware (edge) dan klien
export const AUTH_COOKIE_PREFIX = "kaskita";
export const SESSION_COOKIE_NAMES = [
  `${AUTH_COOKIE_PREFIX}.session_token`,
  `__Secure-${AUTH_COOKIE_PREFIX}.session_token`,
] as const;

export const TRUSTED_SESSION_SECONDS = 30 * 24 * 60 * 60;
export const UNTRUSTED_SESSION_SECONDS = 12 * 60 * 60;

export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 128;

export const LOGIN_PATH = "/login";
export const SESSION_EXPIRED_PARAM = "sesi";

export const PATHNAME_HEADER = "x-kaskita-pathname";
export const ONBOARDING_PATH = "/mulai";
