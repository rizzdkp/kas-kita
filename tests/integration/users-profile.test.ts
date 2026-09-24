import { and, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb, resetDb, testDb } from "../helpers/db";
import { createAccountRow, createHousehold, type Household } from "../helpers/fixtures";
import { auditLog, users } from "@/server/db/schema";
import { ValidationError } from "@/server/errors";
import { markOnboarded, updateProfile } from "@/server/mutations/users";
import { exportHouseholdData, hasHouseholdAccounts, needsOnboarding, serializeExport } from "@/server/queries/settings";

let h: Household;

beforeEach(async () => {
  await resetDb();
  h = await createHousehold(testDb);
});

afterAll(closeDb);

async function userAudit(userId: string) {
  return testDb.select().from(auditLog).where(and(eq(auditLog.entity, "users"), eq(auditLog.entityId, userId))).orderBy(auditLog.at);
}

async function reload(userId: string) {
  const [row] = await testDb.select().from(users).where(eq(users.id, userId));
  return row!;
}

describe("updateProfile", () => {
  it("menyimpan nama, warna, gajian, dan periode lalu menulis audit dengan diff yang berubah saja", async () => {
    const after = await updateProfile(
      h.rizz,
      { displayName: "  Rizki ", identityColor: "gold", paydayDay: 28, periodMode: "payday_cycle" },
      testDb,
    );
    expect(after).toMatchObject({ displayName: "Rizki", identityColor: "gold", paydayDay: 28, periodMode: "payday_cycle" });

    const audit = await userAudit(h.rizz.user.id);
    expect(audit).toHaveLength(1);
    expect(audit[0]!.actorId).toBe(h.rizz.user.id);
    expect(audit[0]!.action).toBe("update");
    expect(audit[0]!.diff).toEqual({
      display_name: ["Rizz", "Rizki"],
      identity_color: ["violet", "gold"],
      payday_day: [25, 28],
      period_mode: ["calendar", "payday_cycle"],
    });
  });

  it("edit satu field tidak mengubah field lain", async () => {
    await updateProfile(h.rizz, { paydayDay: 10 }, testDb);
    const row = await reload(h.rizz.user.id);
    expect(row).toMatchObject({ displayName: "Rizz", identityColor: "violet", paydayDay: 10, periodMode: "calendar" });
    const audit = await userAudit(h.rizz.user.id);
    expect(audit[0]!.diff).toEqual({ payday_day: [25, 10] });
  });

  it("menolak warna identitas yang dipakai partner dengan pesan yang menyebut namanya", async () => {
    const attempt = updateProfile(h.rizz, { identityColor: "ocean" }, testDb);
    await expect(attempt).rejects.toBeInstanceOf(ValidationError);
    await expect(attempt).rejects.toMatchObject({
      message: "Warna Biru laut sudah dipakai Nadia. Pilih warna lain.",
      fieldErrors: { identityColor: ["Warna Biru laut sudah dipakai Nadia. Pilih warna lain."] },
    });
    expect((await reload(h.rizz.user.id)).identityColor).toBe("violet");
    expect(await userAudit(h.rizz.user.id)).toHaveLength(0);
  });

  it("memakai nama partner terbaru walau objek viewer sudah basi", async () => {
    await updateProfile(h.nadia, { displayName: "Nad" }, testDb);
    await expect(updateProfile(h.rizz, { identityColor: "ocean" }, testDb)).rejects.toThrow("sudah dipakai Nad.");
  });

  it("memilih ulang warna sendiri tidak dianggap bentrok dan tidak menulis audit", async () => {
    await updateProfile(h.rizz, { identityColor: "violet" }, testDb);
    expect(await userAudit(h.rizz.user.id)).toHaveLength(0);
  });

  it.each([0, 32, 15.5, -1])("menolak tanggal gajian %s", async (paydayDay) => {
    await expect(updateProfile(h.rizz, { paydayDay }, testDb)).rejects.toMatchObject({
      message: "Isi tanggal gajian 1 sampai 31",
      fieldErrors: { paydayDay: ["Isi tanggal gajian 1 sampai 31"] },
    });
  });

  it.each([1, 31])("menerima tanggal gajian %s", async (paydayDay) => {
    expect((await updateProfile(h.rizz, { paydayDay }, testDb)).paydayDay).toBe(paydayDay);
  });

  it("menolak nama tampilan kosong", async () => {
    await expect(updateProfile(h.rizz, { displayName: "   " }, testDb)).rejects.toThrow("Isi nama tampilan");
  });
});

describe("pengenalan", () => {
  it("needsOnboarding benar sampai markOnboarded mengisi onboarded_at dan tercatat di audit", async () => {
    expect(needsOnboarding(h.rizz)).toBe(true);
    const now = new Date("2026-09-24T03:00:00Z");
    const after = await markOnboarded(h.rizz, testDb, now);
    expect(after.onboardedAt?.toISOString()).toBe(now.toISOString());
    expect(needsOnboarding({ ...h.rizz, user: after })).toBe(false);
    const audit = await userAudit(h.rizz.user.id);
    expect(audit[0]!.diff).toEqual({ onboarded_at: [null, now.toISOString()] });
  });

  it("hasHouseholdAccounts menandai pengguna kedua cukup mengisi profil", async () => {
    expect(await hasHouseholdAccounts(testDb)).toBe(false);
    await createAccountRow(testDb, { name: "BCA", type: "bank", ownerId: h.rizz.user.id });
    expect(await hasHouseholdAccounts(testDb)).toBe(true);
  });
});

describe("ekspor semua data", () => {
  it("memuat data rumah tangga dengan nominal sebagai string dan tanpa kredensial", async () => {
    await createAccountRow(testDb, { name: "BCA", type: "bank", ownerId: h.rizz.user.id, openingBalance: 9_007_199_254_740_993n });
    const data = await exportHouseholdData(h.rizz, testDb);
    const json = serializeExport(data);
    expect(json).toContain('"openingBalance": "9007199254740993"');
    expect(data.tables.users).toHaveLength(2);
    expect(Object.keys(data.tables.users[0]!)).not.toContain("twoFactorEnabled");
    expect(Object.keys(data.tables)).not.toContain("sessions");
    expect(Object.keys(data.tables)).not.toContain("auth_accounts");
  });
});
