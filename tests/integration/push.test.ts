import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb, resetDb, testDb } from "../helpers/db";
import { createAccountRow, createHousehold, seedBasicCategories, type Household } from "../helpers/fixtures";
import { sql as appSql } from "@/server/db/client";
import { notifications, pushSubscriptions } from "@/server/db/schema";
import { deletePushSubscription, savePushSubscription } from "@/server/mutations/push-subscriptions";
import { createTransaction, updateTransaction } from "@/server/mutations/transactions";
import type { VapidConfig } from "@/server/push/config";
import { dispatchNotificationPush } from "@/server/push/dispatch";
import { startPushListener, stopPushListener } from "@/server/push/listener";
import { sendPushToUser, type PushTarget, type PushTransport } from "@/server/push/send";

const VAPID: VapidConfig = { publicKey: "B".repeat(87), privateKey: "p".repeat(43), subject: "mailto:tes@contoh.id" };
const KEYS = { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" };
const at = new Date("2026-09-12T12:00:00+07:00");

let h: Household;

class FakePushError extends Error {
  constructor(readonly statusCode: number) {
    super(`push ${statusCode}`);
  }
}

function recorder(statusFor: (endpoint: string) => number = () => 201) {
  const calls: Array<{ target: PushTarget; body: Record<string, unknown> }> = [];
  const transport: PushTransport = async (target, body) => {
    calls.push({ target, body: JSON.parse(body) as Record<string, unknown> });
    const status = statusFor(target.endpoint);
    if (status >= 400) throw new FakePushError(status);
  };
  return { calls, transport };
}

async function subscribe(viewer: Household["rizz"], endpoint: string) {
  return savePushSubscription(viewer, { endpoint, keys: KEYS, userAgent: "Tes" }, testDb);
}

async function waitFor(check: () => boolean, ms = 3000): Promise<void> {
  const until = Date.now() + ms;
  while (!check() && Date.now() < until) await new Promise((r) => setTimeout(r, 25));
}

beforeEach(async () => {
  await resetDb();
  h = await createHousehold(testDb);
});

afterAll(async () => {
  await stopPushListener();
  await appSql.end({ timeout: 5 });
  await closeDb();
});

describe("langganan push", () => {
  it("tersimpan per endpoint; endpoint yang sama dipindah ke user yang sedang masuk", async () => {
    await subscribe(h.rizz, "https://push.contoh.test/a");
    await subscribe(h.rizz, "https://push.contoh.test/a");
    expect(await testDb.select().from(pushSubscriptions)).toHaveLength(1);

    await subscribe(h.nadia, "https://push.contoh.test/a");
    const [row] = await testDb.select().from(pushSubscriptions);
    expect(row).toMatchObject({ userId: h.nadia.user.id, p256dh: KEYS.p256dh, auth: KEYS.auth, userAgent: "Tes" });
  });

  it("endpoint bukan https ditolak; hapus hanya milik sendiri", async () => {
    await expect(subscribe(h.rizz, "http://push.contoh.test/a")).rejects.toThrow();
    await subscribe(h.rizz, "https://push.contoh.test/a");
    expect(await deletePushSubscription(h.nadia, { endpoint: "https://push.contoh.test/a" }, testDb)).toBe(0);
    expect(await deletePushSubscription(h.rizz, { endpoint: "https://push.contoh.test/a" }, testDb)).toBe(1);
  });
});

describe("sendPushToUser", () => {
  it("mengirim ke semua perangkat user dan menghapus langganan yang dijawab 404/410", async () => {
    await subscribe(h.rizz, "https://push.contoh.test/hidup");
    await subscribe(h.rizz, "https://push.contoh.test/hilang");
    await subscribe(h.rizz, "https://push.contoh.test/dicabut");
    await subscribe(h.rizz, "https://push.contoh.test/sibuk");
    await subscribe(h.nadia, "https://push.contoh.test/nadia");
    const status: Record<string, number> = {
      "https://push.contoh.test/hilang": 404,
      "https://push.contoh.test/dicabut": 410,
      "https://push.contoh.test/sibuk": 503,
    };
    const { calls, transport } = recorder((e) => status[e] ?? 201);

    const result = await sendPushToUser(h.rizz.user.id, { title: "Kas Kita", body: "Tes", url: "/" }, { db: testDb, transport, vapid: VAPID });

    expect(result).toEqual({ sent: 1, removed: 2, failed: 1 });
    expect(calls.map((c) => c.target.endpoint).sort()).toHaveLength(4);
    const left = (await testDb.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, h.rizz.user.id))).map((r) => r.endpoint).sort();
    expect(left).toEqual(["https://push.contoh.test/hidup", "https://push.contoh.test/sibuk"]);
  });

  it("tanpa VAPID tidak mengirim apa pun", async () => {
    await subscribe(h.rizz, "https://push.contoh.test/a");
    const { calls, transport } = recorder();
    const result = await sendPushToUser(h.rizz.user.id, { title: "Kas Kita", body: "Tes", url: "/" }, { db: testDb, transport, vapid: null });
    expect(result).toEqual({ sent: 0, removed: 0, failed: 0 });
    expect(calls).toHaveLength(0);
  });
});

describe("notifikasi menjadi push", () => {
  let cats: Awaited<ReturnType<typeof seedBasicCategories>>;
  let nadiaCashId: string;

  beforeEach(async () => {
    cats = await seedBasicCategories(testDb);
    nadiaCashId = (await createAccountRow(testDb, { name: "Tunai Nadia", type: "cash", ownerId: h.nadia.user.id, openingBalance: 500_000n })).id;
    await subscribe(h.nadia, "https://push.contoh.test/nadia");
  });

  it("isi push tanpa nominal; detail nominal tetap di notifikasi dalam app", async () => {
    const t = await createTransaction(h.nadia, { kind: "expense", amount: 185_000n, accountId: nadiaCashId, categoryId: cats.groceries.id, occurredAt: at }, testDb);
    await updateTransaction(h.rizz, { id: t.id, version: 1, patch: { amount: 158_000n } }, testDb);
    const [n] = await testDb.select().from(notifications);
    expect((n!.payload as { message: string }).message).toContain("Rp 158.000");

    const { calls, transport } = recorder();
    const result = await dispatchNotificationPush([n!.id], { db: testDb, transport, vapid: VAPID });

    expect(result.sent).toBe(1);
    expect(calls[0]!.target.endpoint).toBe("https://push.contoh.test/nadia");
    expect(calls[0]!.body).toEqual({ title: "Kas Kita", body: "Rizz mengubah Belanja dapur 12 Sep.", url: `/transaksi?id=${t.id}`, tag: `kaskita-${n!.id}` });
    expect(JSON.stringify(calls[0]!.body)).not.toMatch(/Rp|185|158/);
  });

  it("listener mengirim setelah commit, dan tidak mengirim apa pun kalau transaksi DB batal", async () => {
    const { calls, transport } = recorder();
    expect(await startPushListener({ transport, vapid: VAPID })).toBe(true);
    const t = await createTransaction(h.nadia, { kind: "expense", amount: 185_000n, accountId: nadiaCashId, categoryId: cats.groceries.id, occurredAt: at }, testDb);

    await expect(
      testDb.transaction(async (tx) => {
        await updateTransaction(h.rizz, { id: t.id, version: 1, patch: { amount: 99_000n } }, tx);
        throw new Error("batal");
      }),
    ).rejects.toThrow("batal");
    await new Promise((r) => setTimeout(r, 300));
    expect(calls).toHaveLength(0);

    await updateTransaction(h.rizz, { id: t.id, version: 1, patch: { amount: 158_000n } }, testDb);
    await waitFor(() => calls.length > 0);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.body.body).toBe("Rizz mengubah Belanja dapur 12 Sep.");
  });
});
