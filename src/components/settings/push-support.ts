// deteksi kemampuan web push di perangkat ini; dipisah supaya bisa diuji tanpa browser

export type PushSupport = "supported" | "ios-needs-install" | "unsupported";

export interface PushEnvironment {
  userAgent: string;
  maxTouchPoints: number;
  standalone: boolean;
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
}

export function isIos(env: Pick<PushEnvironment, "userAgent" | "maxTouchPoints">): boolean {
  // iPadOS 13+ mengaku Macintosh; layar sentuh yang membedakannya
  return /iPad|iPhone|iPod/.test(env.userAgent) || (/Macintosh/.test(env.userAgent) && env.maxTouchPoints > 1);
}

export function detectPushSupport(env: PushEnvironment): PushSupport {
  // Safari iOS 16.4+ hanya membuka PushManager untuk app yang dipasang ke layar utama
  if (isIos(env) && !env.standalone) return "ios-needs-install";
  if (env.hasServiceWorker && env.hasPushManager && env.hasNotification) return "supported";
  return "unsupported";
}

export function readPushEnvironment(): PushEnvironment {
  const nav = navigator as Navigator & { standalone?: boolean };
  return {
    userAgent: nav.userAgent,
    maxTouchPoints: nav.maxTouchPoints ?? 0,
    standalone: window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true,
    hasServiceWorker: "serviceWorker" in nav,
    hasPushManager: "PushManager" in window,
    hasNotification: "Notification" in window,
  };
}

/** Kunci publik VAPID base64url menjadi byte untuk applicationServerKey. */
export function vapidKeyToBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = `${base64url}${"=".repeat((4 - (base64url.length % 4)) % 4)}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}
