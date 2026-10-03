import { describe, expect, it } from "vitest";
import { getVapidConfig } from "@/server/push/config";
import { buildPushMessage } from "@/server/push/payload";
import { detectPushSupport, vapidKeyToBytes, type PushEnvironment } from "@/components/settings/push-support";

const ID = "0192aaaa-bbbb-7ccc-8ddd-eeeeeeeeeeee";
const TX = "0192aaaa-bbbb-7ccc-8ddd-ffffffffffff";

describe("buildPushMessage", () => {
  it("partner_edit: kalimat tanpa nominal walau payload.message memuatnya", () => {
    const msg = buildPushMessage(
      {
        id: ID,
        kind: "partner_edit",
        payload: {
          entity: "transactions",
          entityId: TX,
          action: "update",
          actorName: "Rizz",
          label: "Belanja dapur",
          occurredAt: "2026-09-12T03:00:00.000Z",
          message: "Rizz mengubah Belanja dapur 12 Sep: Rp 185.000 menjadi Rp 158.000.",
          changes: [{ field: "amount", before: "185000", after: "158000" }],
        },
      },
      "Rizz",
    );
    expect(msg).toEqual({ title: "Kas Kita", body: "Rizz mengubah Belanja dapur 12 Sep.", url: `/transaksi?id=${TX}`, tag: `kaskita-${ID}` });
    expect(JSON.stringify(msg)).not.toMatch(/Rp|185|158/);
  });

  it("hapus dan pulihkan memakai kata kerja sendiri", () => {
    const base = { entity: "accounts", entityId: TX, actorName: "Nadia", label: "Jago", occurredAt: null };
    expect(buildPushMessage({ id: ID, kind: "partner_edit", payload: { ...base, action: "delete" } }, null).body).toBe("Nadia menghapus Jago.");
    expect(buildPushMessage({ id: ID, kind: "partner_edit", payload: { ...base, action: "restore" } }, null).body).toBe("Nadia memulihkan Jago.");
  });

  it("label yang memuat angka dibersihkan supaya nominal tidak bocor", () => {
    const msg = buildPushMessage(
      { id: ID, kind: "partner_edit", payload: { action: "update", actorName: "Rizz", label: "Arisan Rp 500.000 1,5jt", entity: "goals", entityId: TX } },
      null,
    );
    expect(msg.body).toBe("Rizz mengubah Arisan.");
  });

  it("jenis lain memakai kalimat cadangan COPY.md dan tautan halaman", () => {
    expect(buildPushMessage({ id: ID, kind: "bill_due", payload: { message: "Listrik Rp 450.000 jatuh tempo" } }, null)).toMatchObject({
      body: "Ada tagihan yang jatuh tempo 3 hari lagi.",
      url: "/tagihan",
    });
    expect(buildPushMessage({ id: ID, kind: "budget_over", payload: {} }, null).body).toBe("Ada anggaran wajib yang lewat.");
    expect(buildPushMessage({ id: ID, kind: "recurring_pending", payload: null }, null).body).toBe(
      "Ada transaksi berulang yang menunggu konfirmasi.",
    );
  });

  it("payload rusak tetap menghasilkan pesan cadangan; href ke domain lain ditolak", () => {
    expect(buildPushMessage({ id: ID, kind: "partner_edit", payload: "x" }, null)).toMatchObject({
      body: "Ada perubahan pada data milikmu.",
      url: "/notifikasi",
    });
    const evil = buildPushMessage({ id: ID, kind: "partner_edit", payload: { href: "//jahat.example" } }, "Nadia");
    expect(evil).toMatchObject({ body: "Nadia mengubah data milikmu.", url: "/notifikasi" });
  });
});

describe("getVapidConfig", () => {
  const publicKey = "B".repeat(87);
  const privateKey = "p".repeat(43);
  it("lengkap dan valid", () => {
    expect(getVapidConfig({ VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey, VAPID_SUBJECT: "mailto:a@contoh.id" })).toEqual({
      publicKey,
      privateKey,
      subject: "mailto:a@contoh.id",
    });
  });
  it("kosong atau setengah terisi berarti push mati", () => {
    expect(getVapidConfig({})).toBeNull();
    expect(getVapidConfig({ VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey })).toBeNull();
    expect(getVapidConfig({ VAPID_PUBLIC_KEY: "abc", VAPID_PRIVATE_KEY: privateKey, VAPID_SUBJECT: "mailto:a@contoh.id" })).toBeNull();
  });
});

describe("detectPushSupport", () => {
  const full: PushEnvironment = {
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) Chrome/140",
    maxTouchPoints: 0,
    standalone: false,
    hasServiceWorker: true,
    hasPushManager: true,
    hasNotification: true,
  };
  const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1";

  it("Chromium desktop didukung", () => expect(detectPushSupport(full)).toBe("supported"));
  it("iPhone di Safari perlu dipasang ke layar utama", () =>
    expect(detectPushSupport({ ...full, userAgent: iphone, hasPushManager: false })).toBe("ios-needs-install"));
  it("iPadOS mengaku Macintosh tapi layar sentuh", () =>
    expect(detectPushSupport({ ...full, userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", maxTouchPoints: 5 })).toBe(
      "ios-needs-install",
    ));
  it("iPhone yang sudah dipasang memakai dukungan biasa", () =>
    expect(detectPushSupport({ ...full, userAgent: iphone, standalone: true })).toBe("supported"));
  it("tanpa PushManager tidak didukung", () => expect(detectPushSupport({ ...full, hasPushManager: false })).toBe("unsupported"));
});

describe("vapidKeyToBytes", () => {
  it("base64url tanpa padding jadi byte", () => {
    expect(Array.from(vapidKeyToBytes("AQID_-8"))).toEqual([1, 2, 3, 255, 239]);
  });
});
