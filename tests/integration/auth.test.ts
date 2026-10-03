import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = process.env.AUTH_TEST_DATABASE_URL ?? "postgres://kaskita:kaskita@localhost:5432/kaskita_test_auth";
  process.env.APP_URL = "http://localhost:3000";
  process.env.AUTH_SECRET ??= "rahasia-tes-auth-yang-cukup-panjang-untuk-hmac";
});

import { eq } from "drizzle-orm";
import { isAPIError } from "better-auth/api";
import { auth } from "@/server/auth/auth";
import { createUser, CreateUserError, setUserPassword } from "@/server/auth/create-user";
import { getLoginLock, LOGIN_LOCK_MS, recordFailedLogin } from "@/server/auth/rate-limit";
import { getViewerFromHeaders, listSessions, revokeSession } from "@/server/auth/session";
import { capUntrustedExpiry } from "@/server/auth/session-policy";
import { db } from "@/server/db/client";
import { authAccounts, sessions } from "@/server/db/schema";
import { mergeSetCookies, parseSetCookies, resetAuthTables, sessionHeadersFor } from "./auth-helpers";

const HOUR = 60 * 60 * 1000;
const PASSWORD = "kuda-laut-biru-42";
const INVALID = "Email atau password salah. Cek lagi lalu coba lagi.";

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

const rizz = (extra: Partial<Parameters<typeof createUser>[0]> = {}) =>
  createUser({ email: "rizz@example.com", name: "Rizz", color: "violet", password: PASSWORD, ...extra });

function signIn(remember: boolean | undefined, ip = "10.0.4.1", password = PASSWORD) {
  const body = remember === undefined ? { email: "rizz@example.com", password } : { email: "rizz@example.com", password, rememberMe: remember };
  return auth.api.signInEmail({ body, headers: new Headers({ "x-forwarded-for": ip }), returnHeaders: true });
}

describe("createUser", () => {
  it("menolak pengguna ketiga dengan pesan jelas", async () => {
    await rizz();
    await createUser({ email: "nara@example.com", name: "Nara", color: "rose", password: PASSWORD });
    await expect(createUser({ email: "tiga@example.com", name: "Tiga", color: "gold", password: PASSWORD })).rejects.toThrow(
      "Kas Kita sudah punya dua pengguna",
    );
  });

  it("menolak warna identitas yang sudah dipakai", async () => {
    await rizz();
    const attempt = createUser({ email: "nara@example.com", name: "Nara", color: "violet", password: PASSWORD });
    await expect(attempt).rejects.toBeInstanceOf(CreateUserError);
    await expect(attempt).rejects.toThrow("Warna violet sudah dipakai");
  });

  it("menolak password kurang dari 12 karakter tanpa membuat pengguna", async () => {
    await expect(rizz({ password: "pendek-11ch" })).rejects.toThrow("Password minimal 12 karakter.");
    expect(await db.select().from(authAccounts)).toHaveLength(0);
  });

  it("membuat user + akun kredensial ber-hash, memilih warna bebas, email huruf kecil", async () => {
    await rizz();
    const user = await createUser({ email: "Nara@Example.com", name: "Nara", payday: 1, password: PASSWORD });
    expect(user.identityColor).not.toBe("violet");
    expect(user.email).toBe("nara@example.com");
    expect(user.paydayDay).toBe(1);
    const [account] = await db.select().from(authAccounts).where(eq(authAccounts.userId, user.id));
    expect(account?.providerId).toBe("credential");
    expect(account?.password).toBeTruthy();
    expect(account?.password).not.toContain(PASSWORD);
  });

  it("email yang sudah ada diarahkan ke --reset-password", async () => {
    await rizz();
    await expect(rizz({ color: "rose" })).rejects.toThrow("Pakai --reset-password");
  });
});

describe("login email + password", () => {
  it("berhasil langsung membuat sesi tanpa langkah TOTP", async () => {
    await rizz();
    const result = await signIn(false);
    expect(result.response).not.toHaveProperty("twoFactorRedirect");
    expect(result.response.token).toBeTruthy();
    const viewer = await getViewerFromHeaders(mergeSetCookies(new Headers(), result.headers));
    expect(viewer?.user.email).toBe("rizz@example.com");
  });

  it("password salah ditolak dengan pesan COPY", async () => {
    await rizz();
    const err = await errorOf(signIn(true, "10.0.4.2", "salah-salah-salah"));
    expect(err.status).toBe(401);
    expect(err.message).toBe(INVALID);
  });

  it("signup publik ditolak", async () => {
    const response = await auth.handler(
      new Request("http://localhost:3000/api/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:3000" },
        body: JSON.stringify({ email: "asing@example.com", password: PASSWORD, name: "Asing" }),
      }),
    );
    expect(response.status).toBe(404);
    expect(await db.select().from(authAccounts)).toHaveLength(0);
  });
});

describe("reset password lewat CLI", () => {
  it("mengganti password, mengeluarkan semua perangkat, dan menolak password pendek", async () => {
    const user = await rizz();
    const headers = await sessionHeadersFor(user.id);
    await expect(setUserPassword("rizz@example.com", "pendek", { revokeSessions: true })).rejects.toThrow("minimal 12");
    await setUserPassword("RIZZ@example.com", "password-baru-yang-panjang", { revokeSessions: true });
    expect(await getViewerFromHeaders(headers)).toBeNull();
    expect(await errorOf(signIn(true, "10.0.5.1"))).toMatchObject({ status: 401 });
    expect((await signIn(true, "10.0.5.1", "password-baru-yang-panjang")).response.token).toBeTruthy();
  });

  it("menyetel password tanpa mencabut sesi untuk skrip dev, dan menolak email tak dikenal", async () => {
    const user = await rizz();
    const headers = await sessionHeadersFor(user.id);
    await setUserPassword("rizz@example.com", "password-dev-yang-panjang", { revokeSessions: false });
    expect(await getViewerFromHeaders(headers)).not.toBeNull();
    await expect(setUserPassword("siapa@example.com", PASSWORD, { revokeSessions: false })).rejects.toThrow("Belum ada pengguna");
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

  it("login lewat Better Auth terkunci setelah 5 password salah, password benar pun ditolak", async () => {
    await rizz();
    for (let i = 0; i < 4; i++) {
      const err = await errorOf(signIn(true, "10.0.2.1", "salah-salah-salah"));
      expect(err.message).toBe(INVALID);
    }
    const fifth = await errorOf(signIn(true, "10.0.2.1", "salah-salah-salah"));
    expect(fifth.code).toBe("LOGIN_LOCKED");
    expect(fifth.message).toBe("Terlalu banyak percobaan masuk yang gagal. Coba lagi dalam 15 menit.");
    expect((await errorOf(signIn(true, "10.0.2.1"))).code).toBe("LOGIN_LOCKED");
  });

  it("body tidak valid tidak dihitung sebagai percobaan gagal", async () => {
    await rizz();
    for (let i = 0; i < 6; i++) {
      await errorOf(auth.api.signInEmail({ body: { email: "bukan-email", password: "x" }, headers: new Headers({ "x-forwarded-for": "10.0.2.2" }) }));
    }
    expect(await getLoginLock({ ip: "10.0.2.2" })).toBeNull();
  });

  it("login berhasil menghapus hitungan gagal email", async () => {
    await rizz();
    for (let i = 0; i < 4; i++) await errorOf(signIn(true, `10.0.2.${10 + i}`, "salah-salah-salah"));
    await signIn(true, "10.0.2.20");
    for (let i = 0; i < 4; i++) await errorOf(signIn(true, `10.0.2.${30 + i}`, "salah-salah-salah"));
    expect(await getLoginLock({ ip: "10.0.9.1", email: "rizz@example.com" })).toBeNull();
  });
});

describe("durasi sesi", () => {
  async function sessionOf(token: string) {
    const [row] = await db.select().from(sessions).where(eq(sessions.token, token));
    if (!row) throw new Error("sesi tidak ada");
    return row;
  }

  it("30 hari dengan Ingat perangkat ini, cookie bertahan 30 hari", async () => {
    await rizz();
    const before = Date.now();
    const result = await signIn(true);
    const session = await sessionOf(result.response.token);
    expect(session.trusted).toBe(true);
    const lifetime = session.expiresAt.getTime() - before;
    expect(lifetime).toBeGreaterThan(30 * 24 * HOUR - 60_000);
    expect(lifetime).toBeLessThan(30 * 24 * HOUR + 60_000);
    const cookie = parseSetCookies(result.headers).find((c) => c.name.endsWith("session_token"));
    expect(cookie?.maxAge).toBe(30 * 24 * 60 * 60);
  });

  it("12 jam tanpa centang, cookie sesi browser, dan tidak diperpanjang", async () => {
    await rizz();
    const before = Date.now();
    const result = await signIn(false);
    const session = await sessionOf(result.response.token);
    expect(session.trusted).toBe(false);
    const lifetime = session.expiresAt.getTime() - before;
    expect(lifetime).toBeGreaterThan(12 * HOUR - 60_000);
    expect(lifetime).toBeLessThan(12 * HOUR + 60_000);
    const cookies = parseSetCookies(result.headers);
    expect(cookies.find((c) => c.name.endsWith("session_token"))?.maxAge).toBeNull();
    expect(cookies.some((c) => c.name.endsWith("dont_remember"))).toBe(true);
    const viewer = await getViewerFromHeaders(mergeSetCookies(new Headers(), result.headers));
    expect(viewer?.user.email).toBe("rizz@example.com");
    expect((await sessionOf(result.response.token)).expiresAt.getTime()).toBeLessThanOrEqual(session.expiresAt.getTime());
  });

  // bawaan Better Auth untuk rememberMe kosong adalah true; status sesi dan umur cookie harus tetap selaras
  it("rememberMe yang tidak dikirim mengikuti bawaan Better Auth dengan sesi dan cookie yang selaras", async () => {
    await rizz();
    const result = await signIn(undefined);
    expect((await sessionOf(result.response.token)).trusted).toBe(true);
    expect(parseSetCookies(result.headers).find((c) => c.name.endsWith("session_token"))?.maxAge).toBe(30 * 24 * 60 * 60);
  });

  it("sesi tanpa sinyal tetap tidak melewati 12 jam saat di-refresh", async () => {
    const user = await rizz();
    const headers = await sessionHeadersFor(user.id);
    const [created] = await db.select().from(sessions).where(eq(sessions.userId, user.id));
    expect(created?.trusted).toBe(false);
    expect(await getViewerFromHeaders(headers)).not.toBeNull();
    const [after] = await db.select().from(sessions).where(eq(sessions.userId, user.id));
    expect(after?.expiresAt.getTime()).toBeLessThanOrEqual((created?.createdAt.getTime() ?? 0) + 12 * HOUR);
  });

  it("perpanjangan sesi tidak tepercaya dibatasi 12 jam sejak dibuat", () => {
    const created = new Date("2026-09-24T00:00:00Z");
    expect(capUntrustedExpiry(created, new Date("2026-10-24T00:00:00Z")).toISOString()).toBe("2026-09-24T12:00:00.000Z");
    expect(capUntrustedExpiry(created, new Date("2026-09-24T05:00:00Z")).toISOString()).toBe("2026-09-24T05:00:00.000Z");
  });
});

describe("ganti password", () => {
  it("mencabut sesi lain dan sesi pengganti mewarisi status tepercaya", async () => {
    const user = await rizz();
    const other = await sessionHeadersFor(user.id);
    const login = await signIn(true);
    const current = mergeSetCookies(new Headers({ "x-forwarded-for": "10.0.4.1" }), login.headers);
    const changed = await auth.api.changePassword({
      body: { currentPassword: PASSWORD, newPassword: "password-baru-yang-panjang", revokeOtherSessions: true },
      headers: current,
      returnHeaders: true,
    });
    expect(await getViewerFromHeaders(other)).toBeNull();
    const rows = await db.select().from(sessions).where(eq(sessions.userId, user.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.trusted).toBe(true);
    expect(await getViewerFromHeaders(mergeSetCookies(current, changed.headers))).not.toBeNull();
  });

  it("password lama salah ditolak", async () => {
    await rizz();
    const login = await signIn(false);
    const err = await errorOf(
      auth.api.changePassword({
        body: { currentPassword: "bukan-password-lama", newPassword: "password-baru-yang-panjang" },
        headers: mergeSetCookies(new Headers(), login.headers),
      }),
    );
    expect(err.code).toBe("INVALID_PASSWORD");
  });
});

describe("getViewer", () => {
  it("mengembalikan partner yang benar", async () => {
    const r = await rizz();
    const alone = await getViewerFromHeaders(await sessionHeadersFor(r.id));
    expect(alone?.user.id).toBe(r.id);
    expect(alone?.partner).toBeNull();

    const nara = await createUser({ email: "nara@example.com", name: "Nara", color: "rose", password: PASSWORD });
    const asRizz = await getViewerFromHeaders(await sessionHeadersFor(r.id));
    const asNara = await getViewerFromHeaders(await sessionHeadersFor(nara.id));
    expect(asRizz?.partner?.id).toBe(nara.id);
    expect(asNara?.partner?.id).toBe(r.id);
    expect(asNara?.user.displayName).toBe("Nara");
  });

  it("tanpa cookie sesi mengembalikan null", async () => {
    expect(await getViewerFromHeaders(new Headers())).toBeNull();
  });

  it("daftar sesi dan cabut sesi hanya untuk milik sendiri", async () => {
    const r = await rizz();
    const nara = await createUser({ email: "nara@example.com", name: "Nara", color: "rose", password: PASSWORD });
    const rizzHeaders = await sessionHeadersFor(r.id, { "user-agent": "Safari iPhone" });
    await sessionHeadersFor(r.id);
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
