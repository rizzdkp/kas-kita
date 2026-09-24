import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = process.env.AUTH_TEST_DATABASE_URL ?? "postgres://kaskita:kaskita@localhost:5432/kaskita_test_auth";
  process.env.APP_URL = "http://localhost:3000";
  process.env.AUTH_SECRET ??= "rahasia-tes-auth-yang-cukup-panjang-untuk-hmac";
});

import { eq } from "drizzle-orm";
import { isAPIError } from "better-auth/api";
import { auth } from "@/server/auth/auth";
import { createUser, CreateUserError } from "@/server/auth/create-user";
import { consumeEnrollmentToken, createEnrollmentToken, findEnrollmentUser } from "@/server/auth/enrollment";
import { getLoginLock, LOGIN_LOCK_MS, recordFailedLogin } from "@/server/auth/rate-limit";
import { getViewerFromHeaders, listSessions, revokeSession } from "@/server/auth/session";
import { capUntrustedExpiry } from "@/server/auth/session-policy";
import { db } from "@/server/db/client";
import { sessions } from "@/server/db/schema";
import { enableBackupLogin, mergeSetCookies, resetAuthTables, sessionHeadersFor, totpCode } from "./auth-helpers";

const HOUR = 60 * 60 * 1000;
const PASSWORD = "kuda-laut-biru-42";

beforeAll(async () => {
  await auth.$context;
});

beforeEach(async () => {
  await resetAuthTables();
});

async function errorOf(promise: Promise<unknown>): Promise<{ code: string; message: string; status: number }> {
  try {
    await promise;
  } catch (error) {
    if (isAPIError(error)) {
      return { code: String(error.body?.code ?? ""), message: String(error.body?.message ?? ""), status: error.statusCode };
    }
    throw error;
  }
  throw new Error("seharusnya gagal");
}

describe("createUser", () => {
  it("menolak pengguna ketiga dengan pesan jelas", async () => {
    await createUser({ email: "rizz@example.com", name: "Rizz", color: "violet" });
    await createUser({ email: "nara@example.com", name: "Nara", color: "rose" });
    await expect(createUser({ email: "tiga@example.com", name: "Tiga", color: "gold" })).rejects.toThrow(
      "Kas Kita sudah punya dua pengguna",
    );
  });

  it("menolak warna identitas yang sudah dipakai", async () => {
    await createUser({ email: "rizz@example.com", name: "Rizz", color: "violet" });
    const attempt = createUser({ email: "nara@example.com", name: "Nara", color: "violet" });
    await expect(attempt).rejects.toBeInstanceOf(CreateUserError);
    await expect(createUser({ email: "nara@example.com", name: "Nara", color: "violet" })).rejects.toThrow(
      "Warna violet sudah dipakai",
    );
  });

  it("memilih warna bebas kalau tidak diisi dan mencetak tautan sekali pakai 30 menit", async () => {
    const now = new Date("2026-09-24T01:00:00Z");
    await createUser({ email: "rizz@example.com", name: "Rizz", color: "violet" }, now);
    const { user, enrollmentUrl } = await createUser({ email: "Nara@Example.com", name: "Nara", payday: 1 }, now);
    expect(user.identityColor).not.toBe("violet");
    expect(user.email).toBe("nara@example.com");
    expect(user.paydayDay).toBe(1);
    const token = new URL(enrollmentUrl).searchParams.get("token") ?? "";
    expect(new URL(enrollmentUrl).pathname).toBe("/daftar-perangkat");
    expect((await findEnrollmentUser(token, new Date(now.getTime() + 29 * 60_000)))?.id).toBe(user.id);
    expect(await findEnrollmentUser(token, new Date(now.getTime() + 31 * 60_000))).toBeNull();
    expect(await consumeEnrollmentToken(token, now)).toBe(user.id);
    expect(await consumeEnrollmentToken(token, now)).toBeNull();
  });

  it("tautan baru menggantikan tautan lama", async () => {
    const { user } = await createUser({ email: "rizz@example.com", name: "Rizz" });
    const first = await createEnrollmentToken(user.id);
    const second = await createEnrollmentToken(user.id);
    expect(await findEnrollmentUser(first)).toBeNull();
    expect((await findEnrollmentUser(second))?.id).toBe(user.id);
  });
});

describe("rate limit login", () => {
  const identity = { ip: "10.0.0.1", email: "rizz@example.com" };

  it("terkunci setelah 5 gagal dalam 15 menit dan terbuka setelah 15 menit", async () => {
    const start = new Date("2026-09-24T02:00:00Z");
    for (let i = 0; i < 4; i++) {
      expect(await recordFailedLogin(identity, new Date(start.getTime() + i * 60_000))).toBeNull();
    }
    const fifth = new Date(start.getTime() + 10 * 60_000);
    const lock = await recordFailedLogin(identity, fifth);
    expect(lock?.lockedUntil.getTime()).toBe(fifth.getTime() + LOGIN_LOCK_MS);
    expect(await getLoginLock(identity, new Date(fifth.getTime() + 14 * 60_000))).not.toBeNull();
    expect(await getLoginLock({ ip: "10.0.0.1" }, new Date(fifth.getTime() + 14 * 60_000))).not.toBeNull();
    const after = new Date(fifth.getTime() + LOGIN_LOCK_MS + 1);
    expect(await getLoginLock(identity, after)).toBeNull();
    expect(await recordFailedLogin(identity, after)).toBeNull();
  });

  it("gagal yang tersebar lebih dari 15 menit tidak mengunci", async () => {
    const start = new Date("2026-09-24T03:00:00Z");
    for (let i = 0; i < 6; i++) {
      expect(await recordFailedLogin(identity, new Date(start.getTime() + i * 4 * 60_000))).toBeNull();
    }
  });

  it("mengunci per email walau IP berganti", async () => {
    const start = new Date("2026-09-24T04:00:00Z");
    for (let i = 0; i < 5; i++) await recordFailedLogin({ ip: `10.0.1.${i}`, email: "nara@example.com" }, start);
    expect(await getLoginLock({ ip: "10.0.9.9", email: "nara@example.com" }, start)).not.toBeNull();
    expect(await getLoginLock({ ip: "10.0.9.9", email: "rizz@example.com" }, start)).toBeNull();
  });

  it("login password lewat Better Auth terkunci setelah 5 kali salah", async () => {
    const { user } = await createUser({ email: "rizz@example.com", name: "Rizz" });
    await enableBackupLogin(user.id, PASSWORD);
    const headers = new Headers({ "x-forwarded-for": "10.0.2.1" });
    for (let i = 0; i < 4; i++) {
      const err = await errorOf(auth.api.signInEmail({ body: { email: "rizz@example.com", password: "salah-salah-salah" }, headers }));
      expect(err.message).toBe("Email atau password salah. Cek lagi, atau masuk dengan passkey.");
    }
    const fifth = await errorOf(auth.api.signInEmail({ body: { email: "rizz@example.com", password: "salah-salah-salah" }, headers }));
    expect(fifth.code).toBe("LOGIN_LOCKED");
    expect(fifth.message).toBe("Terlalu banyak percobaan masuk yang gagal. Coba lagi dalam 15 menit.");
    const correct = await errorOf(auth.api.signInEmail({ body: { email: "rizz@example.com", password: PASSWORD }, headers }));
    expect(correct.code).toBe("LOGIN_LOCKED");
  });
});

describe("password wajib diikuti TOTP", () => {
  it("password tanpa TOTP aktif ditolak", async () => {
    const { user } = await createUser({ email: "rizz@example.com", name: "Rizz" });
    const headers = await sessionHeadersFor(user.id);
    await auth.api.setPassword({ body: { newPassword: PASSWORD }, headers });
    const err = await errorOf(
      auth.api.signInEmail({ body: { email: "rizz@example.com", password: PASSWORD }, headers: new Headers({ "x-forwarded-for": "10.0.3.1" }) }),
    );
    expect(err.status).toBe(401);
  });

  it("password kurang dari 12 karakter ditolak", async () => {
    const { user } = await createUser({ email: "rizz@example.com", name: "Rizz" });
    const headers = await sessionHeadersFor(user.id);
    const err = await errorOf(auth.api.setPassword({ body: { newPassword: "pendek-11ch" }, headers }));
    expect(err.code).toBe("PASSWORD_TOO_SHORT");
  });
});

describe("durasi sesi", () => {
  async function signInWithTotp(remember: boolean) {
    const { user } = await createUser({ email: "rizz@example.com", name: "Rizz" });
    const secret = await enableBackupLogin(user.id, PASSWORD);
    const base = mergeSetCookies(new Headers({ "x-forwarded-for": "10.0.4.1" }), null, remember);
    const signIn = await auth.api.signInEmail({
      body: { email: "rizz@example.com", password: PASSWORD, rememberMe: remember },
      headers: base,
      returnHeaders: true,
    });
    expect(signIn.response).toMatchObject({ twoFactorRedirect: true });
    const pending = mergeSetCookies(base, signIn.headers);
    const verified = await auth.api.verifyTOTP({ body: { code: await totpCode(secret) }, headers: pending, returnHeaders: true });
    const cookies = mergeSetCookies(pending, verified.headers);
    const rows = await db.select().from(sessions).where(eq(sessions.token, verified.response.token));
    return { user, session: rows[0], cookies };
  }

  it("30 hari di perangkat tepercaya", async () => {
    const before = Date.now();
    const { session } = await signInWithTotp(true);
    expect(session?.trusted).toBe(true);
    const lifetime = (session?.expiresAt.getTime() ?? 0) - before;
    expect(lifetime).toBeGreaterThan(30 * 24 * HOUR - 60_000);
    expect(lifetime).toBeLessThan(30 * 24 * HOUR + 60_000);
  });

  it("12 jam di perangkat lain dan tidak diperpanjang", async () => {
    const before = Date.now();
    const { session, cookies } = await signInWithTotp(false);
    expect(session?.trusted).toBe(false);
    const lifetime = (session?.expiresAt.getTime() ?? 0) - before;
    expect(lifetime).toBeGreaterThan(12 * HOUR - 60_000);
    expect(lifetime).toBeLessThan(12 * HOUR + 60_000);
    const viewer = await getViewerFromHeaders(cookies);
    expect(viewer?.user.email).toBe("rizz@example.com");
    const [after] = await db.select().from(sessions).where(eq(sessions.id, session?.id ?? ""));
    expect(after?.expiresAt.getTime()).toBeLessThanOrEqual(session?.expiresAt.getTime() ?? 0);
  });

  it("sesi tidak tepercaya tanpa cookie jangan-ingat tetap tidak melewati 12 jam saat di-refresh", async () => {
    const { user } = await createUser({ email: "rizz@example.com", name: "Rizz" });
    const headers = await sessionHeadersFor(user.id);
    const [created] = await db.select().from(sessions).where(eq(sessions.userId, user.id));
    expect(created?.trusted).toBe(false);
    expect(await getViewerFromHeaders(headers)).not.toBeNull();
    const [after] = await db.select().from(sessions).where(eq(sessions.userId, user.id));
    expect(after?.updatedAt.getTime()).toBeGreaterThanOrEqual(created?.updatedAt.getTime() ?? 0);
    expect(after?.expiresAt.getTime()).toBeLessThanOrEqual((created?.createdAt.getTime() ?? 0) + 12 * HOUR);
  });

  it("perpanjangan sesi tidak tepercaya dibatasi 12 jam sejak dibuat", () => {
    const created = new Date("2026-09-24T00:00:00Z");
    expect(capUntrustedExpiry(created, new Date("2026-10-24T00:00:00Z")).toISOString()).toBe("2026-09-24T12:00:00.000Z");
    expect(capUntrustedExpiry(created, new Date("2026-09-24T05:00:00Z")).toISOString()).toBe("2026-09-24T05:00:00.000Z");
  });
});

describe("getViewer", () => {
  it("mengembalikan partner yang benar", async () => {
    const { user: rizz } = await createUser({ email: "rizz@example.com", name: "Rizz", color: "violet" });
    const alone = await getViewerFromHeaders(await sessionHeadersFor(rizz.id));
    expect(alone?.user.id).toBe(rizz.id);
    expect(alone?.partner).toBeNull();

    const { user: nara } = await createUser({ email: "nara@example.com", name: "Nara", color: "rose" });
    const asRizz = await getViewerFromHeaders(await sessionHeadersFor(rizz.id));
    const asNara = await getViewerFromHeaders(await sessionHeadersFor(nara.id));
    expect(asRizz?.partner?.id).toBe(nara.id);
    expect(asNara?.partner?.id).toBe(rizz.id);
    expect(asNara?.user.displayName).toBe("Nara");
  });

  it("tanpa cookie sesi mengembalikan null", async () => {
    expect(await getViewerFromHeaders(new Headers())).toBeNull();
  });

  it("daftar sesi dan cabut sesi hanya untuk milik sendiri", async () => {
    const { user: rizz } = await createUser({ email: "rizz@example.com", name: "Rizz", color: "violet" });
    const { user: nara } = await createUser({ email: "nara@example.com", name: "Nara", color: "rose" });
    const rizzHeaders = await sessionHeadersFor(rizz.id, { "user-agent": "Safari iPhone" });
    await sessionHeadersFor(rizz.id);
    const viewer = await getViewerFromHeaders(rizzHeaders);
    const naraViewer = await getViewerFromHeaders(await sessionHeadersFor(nara.id));
    if (!viewer || !naraViewer) throw new Error("viewer kosong");
    const list = await listSessions(viewer);
    expect(list).toHaveLength(2);
    expect(list.filter((s) => s.isCurrent)).toHaveLength(1);
    const other = list.find((s) => !s.isCurrent);
    expect(await revokeSession(naraViewer, other?.id ?? "")).toBe(false);
    expect(await revokeSession(viewer, viewer.sessionId)).toBe(true);
    expect(await getViewerFromHeaders(rizzHeaders)).toBeNull();
  });
});
