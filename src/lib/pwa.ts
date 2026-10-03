// konstanta bersama service worker (src/app/sw.ts) dan klien

export const PAGES_CACHE = "kaskita-pages";
export const OFFLINE_PATH = "/~offline";
export const CACHE_PAGE_MESSAGE = "kaskita:cache-page";
export const CLEAR_PAGES_MESSAGE = "kaskita:clear-pages";

// halaman tanpa data (login, offline, galeri dev) dan API tidak disimpan sebagai "data terakhir"
const NOT_CACHED_PREFIXES = ["/api/", "/_next/", "/login", "/~offline", "/dev/"];

export function isCacheablePagePath(pathname: string): boolean {
  if (NOT_CACHED_PREFIXES.some((prefix) => pathname === prefix.replace(/\/$/, "") || pathname.startsWith(prefix))) return false;
  // file statis (ikon, manifest, sw.js) bukan halaman
  return !/\.[a-z0-9]+$/i.test(pathname);
}
