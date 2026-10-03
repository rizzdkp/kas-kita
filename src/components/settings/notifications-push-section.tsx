"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { subscribePushAction, unsubscribePushAction } from "@/server/actions/push";
import { detectPushSupport, readPushEnvironment, vapidKeyToBytes } from "./push-support";

type Status =
  | { name: "checking" }
  | { name: "ios-needs-install" }
  | { name: "unsupported" }
  | { name: "no-worker" }
  | { name: "denied" }
  | { name: "off" }
  | { name: "on"; endpoint: string };

const COPY = {
  notConfigured: "Notifikasi perangkat belum disiapkan di server ini. Kabar tetap muncul di panel Notifikasi.",
  iosNeedsInstall:
    "Di iPhone dan iPad, notifikasi perangkat hanya jalan setelah Kas Kita dipasang ke layar utama (iOS 16.4 ke atas). Di Safari, buka menu Bagikan, pilih Tambah ke Layar Utama, lalu buka Kas Kita dari ikon itu.",
  unsupported: "Browser ini belum mendukung notifikasi perangkat. Kabar tetap muncul di panel Notifikasi.",
  noWorker: "Notifikasi perangkat belum siap di halaman ini. Muat ulang halaman lalu coba lagi.",
  denied: "Izin notifikasi untuk Kas Kita ditolak di browser ini. Izinkan notifikasi di pengaturan situs browser, lalu muat ulang halaman ini.",
  off: "Belum aktif di perangkat ini.",
  on: "Aktif di perangkat ini.",
  privacy: "Notifikasi perangkat tidak memuat nominal karena bisa terbaca di layar kunci. Detailnya ada di Kas Kita.",
  enable: "Aktifkan notifikasi di perangkat ini",
  disable: "Matikan",
  enabledToast: "Notifikasi perangkat aktif",
  disabledToast: "Notifikasi perangkat dimatikan",
  failed: "Notifikasi perangkat belum bisa diaktifkan. Coba lagi.",
} as const;

// service worker hanya terpasang di build produksi dan baru aktif setelah precache; jangan menunggu selamanya
const WORKER_TIMEOUT_MS = 8000;

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  const timeout = new Promise<null>((resolve) => window.setTimeout(() => resolve(null), WORKER_TIMEOUT_MS));
  return Promise.race([navigator.serviceWorker.ready, timeout]);
}

/** Pengaturan → Notifikasi: langganan web push untuk perangkat ini (F-NOT-1 AC1). */
export function NotificationsPushSection({ publicKey }: { publicKey: string | null }) {
  const toast = useToast();
  const [status, setStatus] = useState<Status>({ name: "checking" });
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const support = detectPushSupport(readPushEnvironment());
    if (support !== "supported") {
      setStatus(support === "ios-needs-install" ? { name: "ios-needs-install" } : { name: "unsupported" });
      return;
    }
    if (Notification.permission === "denied") {
      setStatus({ name: "denied" });
      return;
    }
    const reg = await getRegistration();
    if (!reg) {
      setStatus({ name: "no-worker" });
      return;
    }
    const sub = await reg.pushManager.getSubscription();
    setStatus(sub ? { name: "on", endpoint: sub.endpoint } : { name: "off" });
  }, []);

  useEffect(() => {
    if (publicKey) void refresh().catch(() => setStatus({ name: "unsupported" }));
  }, [publicKey, refresh]);

  if (!publicKey) return <p className="text-body text-secondary">{COPY.notConfigured}</p>;

  async function enable(key: string) {
    setBusy(true);
    try {
      // izin diminta hanya setelah klik, sesuai aturan browser dan supaya tidak mengejutkan
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? { name: "denied" } : { name: "off" });
        return;
      }
      const reg = await getRegistration();
      if (!reg) {
        setStatus({ name: "no-worker" });
        return;
      }
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKeyToBytes(key) }));
      const json = sub.toJSON();
      const result = await subscribePushAction({
        endpoint: sub.endpoint,
        keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
        userAgent: navigator.userAgent.slice(0, 400),
      });
      if (!result.ok) {
        await sub.unsubscribe().catch(() => false);
        toast.show({ title: result.error });
        setStatus({ name: "off" });
        return;
      }
      setStatus({ name: "on", endpoint: sub.endpoint });
      toast.show({ title: COPY.enabledToast });
    } catch {
      toast.show({ title: COPY.failed });
    } finally {
      setBusy(false);
    }
  }

  async function disable(endpoint: string) {
    setBusy(true);
    try {
      const reg = await getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      await sub?.unsubscribe();
      await unsubscribePushAction(endpoint);
      setStatus({ name: "off" });
      toast.show({ title: COPY.disabledToast });
    } catch {
      toast.show({ title: COPY.failed });
    } finally {
      setBusy(false);
    }
  }

  const message: Record<Exclude<Status["name"], "checking">, string> = {
    "ios-needs-install": COPY.iosNeedsInstall,
    unsupported: COPY.unsupported,
    "no-worker": COPY.noWorker,
    denied: COPY.denied,
    off: COPY.off,
    on: COPY.on,
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1" aria-live="polite">
        <p className="text-body text-primary" data-testid="push-status">
          {status.name === "checking" ? "Memeriksa perangkat ini" : message[status.name]}
        </p>
        {status.name === "on" || status.name === "off" ? <p className="text-small text-secondary">{COPY.privacy}</p> : null}
      </div>
      {status.name === "off" ? (
        <Button variant="secondary" loading={busy} onClick={() => void enable(publicKey)} className="self-start">
          {COPY.enable}
        </Button>
      ) : null}
      {status.name === "on" ? (
        <Button variant="secondary" loading={busy} onClick={() => void disable(status.endpoint)} className="self-start">
          {COPY.disable}
        </Button>
      ) : null}
    </div>
  );
}
