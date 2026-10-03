/// <reference lib="webworker" />
import {
  CacheFirst,
  ExpirationPlugin,
  NetworkFirst,
  NetworkOnly,
  Serwist,
  StaleWhileRevalidate,
  type PrecacheEntry,
  type SerwistGlobalConfig,
  type SerwistPlugin,
} from "serwist";
import { CACHE_PAGE_MESSAGE, CLEAR_PAGES_MESSAGE, OFFLINE_PATH, PAGES_CACHE, isCacheablePagePath } from "@/lib/pwa";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const LOGIN_PATH = "/login";

function sameOrigin(url: URL): boolean {
  return url.origin === self.location.origin;
}

function isPageRequest(request: Request, url: URL): boolean {
  if (request.method !== "GET" || !sameOrigin(url) || !isCacheablePagePath(url.pathname)) return false;
  // payload RSC dan prefetch Next punya header RSC; yang disimpan hanya HTML utuh
  if (request.headers.has("RSC") || url.searchParams.has("_rsc")) return false;
  return request.mode === "navigate" || request.destination === "document";
}

async function clearPages(): Promise<void> {
  await caches.delete(PAGES_CACHE);
}

// sesi berakhir (dialihkan ke login) berarti data terakhir milik sesi itu tidak boleh tersisa di perangkat
async function acceptPage(response: Response): Promise<Response | null> {
  if (response.redirected && new URL(response.url).pathname.startsWith(LOGIN_PATH)) {
    await clearPages();
    return null;
  }
  const type = response.headers.get("content-type") ?? "";
  return response.status === 200 && type.includes("text/html") ? response : null;
}

const pagesGuard: SerwistPlugin = { cacheWillUpdate: ({ response }) => acceptPage(response) };

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // API memuat data pribadi, lampiran, dan ekspor: selalu ke jaringan, tidak pernah disimpan
    { matcher: ({ url, sameOrigin: same }) => same && url.pathname.startsWith("/api/"), handler: new NetworkOnly() },
    {
      matcher: ({ url, sameOrigin: same }) => same && url.pathname.startsWith("/_next/static/"),
      handler: new CacheFirst({
        cacheName: "next-static",
        plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 })],
      }),
    },
    {
      matcher: ({ url, sameOrigin: same }) => same && /\.(?:png|svg|ico|webp|woff2)$/i.test(url.pathname),
      handler: new StaleWhileRevalidate({
        cacheName: "static-assets",
        // aset 3D kategori, halaman, dan logo merek berjumlah ratusan berkas kecil
        plugins: [new ExpirationPlugin({ maxEntries: 240, maxAgeSeconds: 30 * 24 * 60 * 60 })],
      }),
    },
    {
      // halaman app: jaringan dulu, salinan terakhir saat offline (PRD 8, ARCHITECTURE 9)
      matcher: ({ request, url }) => isPageRequest(request, url),
      handler: new NetworkFirst({
        cacheName: PAGES_CACHE,
        networkTimeoutSeconds: 8,
        matchOptions: { ignoreVary: true },
        plugins: [
          pagesGuard,
          new ExpirationPlugin({ maxEntries: 40, maxAgeSeconds: 14 * 24 * 60 * 60 }),
        ],
      }),
    },
  ],
  fallbacks: {
    entries: [{ url: OFFLINE_PATH, matcher: ({ request }) => request.mode === "navigate" || request.destination === "document" }],
  },
});

// halaman yang dibuka lewat navigasi klien Next tidak lewat SW sebagai dokumen; klien meminta disimpan
async function cachePage(href: string): Promise<void> {
  const url = new URL(href, self.location.origin);
  if (!sameOrigin(url) || !isCacheablePagePath(url.pathname)) return;
  const response = await fetch(url, { credentials: "same-origin", headers: { accept: "text/html" } });
  const accepted = await acceptPage(response);
  if (!accepted) return;
  const cache = await caches.open(PAGES_CACHE);
  await cache.put(url.href, accepted);
}

self.addEventListener("message", (event) => {
  const data: unknown = event.data;
  if (typeof data !== "object" || data === null || !("type" in data)) return;
  if (data.type === CLEAR_PAGES_MESSAGE) {
    event.waitUntil(clearPages());
    return;
  }
  if (data.type === CACHE_PAGE_MESSAGE && "url" in data && typeof data.url === "string") {
    event.waitUntil(cachePage(data.url).catch(() => undefined));
  }
});

interface PushData {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

function parsePush(event: PushEvent): PushData | null {
  try {
    const data: unknown = event.data?.json();
    if (typeof data !== "object" || data === null) return null;
    const { title, body, url, tag } = data as Record<string, unknown>;
    if (typeof title !== "string" || typeof body !== "string") return null;
    const path = typeof url === "string" && url.startsWith("/") && !url.startsWith("//") ? url : "/";
    return { title, body, url: path, tag: typeof tag === "string" ? tag : undefined };
  } catch {
    return null;
  }
}

self.addEventListener("push", (event) => {
  const data = parsePush(event) ?? { title: "Kas Kita", body: "Ada notifikasi baru.", url: "/notifikasi" };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      lang: "id",
      data: { url: data.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw: unknown = event.notification.data;
  const path = typeof raw === "object" && raw !== null && "url" in raw && typeof raw.url === "string" ? raw.url : "/";
  const target = new URL(path, self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (existing) {
        await existing.focus();
        await existing.navigate(target).catch(() => undefined);
        return;
      }
      await self.clients.openWindow(target);
    })(),
  );
});

serwist.addEventListeners();
