import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { closeDb, resetDb, testDb } from "../helpers/db";
import { createAccountRow, createHousehold, type Household } from "../helpers/fixtures";
import type { Viewer } from "@/server/auth/viewer";
import { accounts, auditLog, importBatches, importRows, importTemplates, institutions } from "@/server/db/schema";
import { inspectCsv } from "@/server/import/csv/inspect";
import { applyCsvMapping } from "@/server/import/csv/upload";
import { cleanupImportFiles, importFilePath } from "@/server/import/files";

const session = vi.hoisted(() => ({ viewer: null as Viewer | null }));
vi.mock("@/server/auth/session", () => ({ getViewerFromHeaders: async () => session.viewer }));

const { POST } = await import("@/app/api/imports/route");

const TODAY = "2026-09-24";
const fixture = (name: string) => readFileSync(join(process.cwd(), "tests/fixtures/imports/csv", name));
let dir: string;
let h: Household;
let bcaInstitution: string;
let bcaAccount: string;

type UploadBody = { status?: string; batchId?: string; next?: string; error?: string; code?: string; href?: string };

async function upload(bytes: Uint8Array, accountId: string, name = "mutasi.csv"): Promise<{ status: number; body: UploadBody }> {
  const form = new FormData();
  form.set("accountId", accountId);
  form.set("file", new File([new Uint8Array(bytes)], name));
  const res = await POST(new Request("http://localhost/api/imports", { method: "POST", body: form, headers: { host: "localhost", origin: "http://localhost" } }));
  return { status: res.status, body: (await res.json()) as UploadBody };
}

function suggestionFor(bytes: Uint8Array) {
  return inspectCsv(bytes, TODAY).suggestion;
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "kaskita-impor-"));
  process.env.IMPORTS_DIR = dir;
});

afterAll(async () => {
  rmSync(dir, { recursive: true, force: true });
  await closeDb();
});

beforeEach(async () => {
  await resetDb();
  h = await createHousehold(testDb);
  session.viewer = h.rizz;
  const [inst] = await testDb.insert(institutions).values({ name: "BCA", slug: "bca", kind: "bank" }).returning();
  bcaInstitution = inst!.id;
  const account = await createAccountRow(testDb, { name: "BCA Rizz", type: "bank", ownerId: h.rizz.user.id });
  await testDb.update(accounts).set({ institutionId: bcaInstitution }).where(eq(accounts.id, account.id));
  bcaAccount = account.id;
});

describe("unggah CSV tanpa templat", () => {
  it("membuat batch parsing, menyimpan file sementara, dan mengarah ke pemetaan", async () => {
    const { status, body } = await upload(fixture("bca-mutasi.csv"), bcaAccount);
    expect(status).toBe(200);
    expect(body).toMatchObject({ status: "mapping", next: `/impor/${body.batchId}/pemetaan` });
    const [batch] = await testDb.select().from(importBatches).where(eq(importBatches.id, body.batchId!));
    expect(batch).toMatchObject({ status: "parsing", format: "csv", accountId: bcaAccount, institutionId: bcaInstitution, createdBy: h.rizz.user.id });
    expect(batch!.fileSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(existsSync(importFilePath(body.batchId!, "csv", dir))).toBe(true);
  });

  it("pemetaan menyimpan baris ber-row_hash, menjalankan dedupe, dan menyimpan templat dengan audit", async () => {
    const bytes = fixture("bca-mutasi.csv");
    const { body } = await upload(bytes, bcaAccount);
    const result = await applyCsvMapping(h.rizz, { batchId: body.batchId!, mapping: suggestionFor(bytes), saveTemplate: true }, { today: TODAY });
    expect(result.count).toBe(6);

    const rows = await testDb.select().from(importRows).where(eq(importRows.batchId, body.batchId!));
    expect(rows).toHaveLength(6);
    for (const row of rows) expect(row.rowHash).toMatch(/^[0-9a-f]{64}$/);
    const amounts = rows.map((r) => (r.parsed as { amount: string }).amount).sort();
    expect(amounts).toEqual(["-10000", "-1250000", "-25000", "-500000", "3512", "8500000"].sort());
    expect((rows[0]!.raw as Record<string, string>)["Keterangan"]).toBeDefined();
    const [batch] = await testDb.select().from(importBatches).where(eq(importBatches.id, body.batchId!));
    expect(batch!.status).toBe("review");

    const [template] = await testDb.select().from(importTemplates).where(eq(importTemplates.institutionId, bcaInstitution));
    expect(template).toMatchObject({ name: "BCA", version: 1 });
    expect(template!.mapping).toMatchObject({ dateColumn: "Tanggal Transaksi", amountColumn: "Mutasi", decimalSeparator: "." });
    const audit = await testDb.select().from(auditLog).where(and(eq(auditLog.entity, "import_templates"), eq(auditLog.entityId, template!.id)));
    expect(audit.map((a) => a.action)).toEqual(["insert"]);
    expect(audit[0]!.actorId).toBe(h.rizz.user.id);
  });

  it("pemetaan tanpa centang templat tidak menyimpan templat", async () => {
    const bytes = fixture("debit-kredit-id.csv");
    const { body } = await upload(bytes, bcaAccount);
    await applyCsvMapping(h.rizz, { batchId: body.batchId!, mapping: suggestionFor(bytes), saveTemplate: false }, { today: TODAY });
    expect(await testDb.select().from(importTemplates)).toHaveLength(0);
  });

  it("Windows-1252 tersimpan sebagai teks yang benar", async () => {
    const bytes = fixture("windows-1252.csv");
    const { body } = await upload(bytes, bcaAccount);
    await applyCsvMapping(h.rizz, { batchId: body.batchId!, mapping: suggestionFor(bytes), saveTemplate: false }, { today: TODAY });
    const rows = await testDb.select().from(importRows).where(eq(importRows.batchId, body.batchId!));
    expect(rows.map((r) => (r.parsed as { description: string }).description).sort()).toEqual(["Café Kopi Contoh", "Crème brûlée Toko Kue", "Transfer masuk Nadía"]);
  });
});

describe("templat institusi", () => {
  async function saveBcaTemplate() {
    const bytes = fixture("bca-mutasi.csv");
    const first = await upload(bytes, bcaAccount);
    await applyCsvMapping(h.rizz, { batchId: first.body.batchId!, mapping: suggestionFor(bytes), saveTemplate: true }, { today: TODAY });
  }

  it("dipakai otomatis di unggahan berikutnya: langsung ke tinjau tanpa pemetaan", async () => {
    await saveBcaTemplate();
    // mutasi bulan berikutnya: file berbeda, satu baris judul tambahan di atas tabel
    const next = Buffer.from(
      fixture("bca-mutasi.csv")
        .toString("utf8")
        .replace("Informasi Rekening - Mutasi Rekening", "Informasi Rekening - Mutasi Rekening\r\nDicetak : ,24/09/2026")
        .replace("BIAYA ADM", "BIAYA ADMIN"),
    );
    const { status, body } = await upload(next, bcaAccount);
    expect(status).toBe(200);
    expect(body).toMatchObject({ status: "review", next: `/impor/${body.batchId}` });
    const rows = await testDb.select().from(importRows).where(eq(importRows.batchId, body.batchId!));
    expect(rows).toHaveLength(6);
  });

  it("kolom templat tidak ada di file: kembali ke pemetaan", async () => {
    await saveBcaTemplate();
    const { body } = await upload(fixture("nominal-bertanda.csv"), bcaAccount);
    expect(body.status).toBe("mapping");
  });

  it("baris rusak dengan templat: ke pemetaan supaya baris yang dilewati terlihat", async () => {
    const bytes = fixture("ringkasan-header.csv");
    const first = await upload(bytes, bcaAccount);
    const mapping = suggestionFor(bytes);
    await testDb.insert(importTemplates).values({ institutionId: bcaInstitution, name: "BCA", mapping });
    await testDb.delete(importBatches).where(eq(importBatches.id, first.body.batchId!));
    const { body } = await upload(bytes, bcaAccount);
    expect(body.status).toBe("mapping");
  });

  it("memperbarui templat yang ada menaikkan versi dan mencatat diff", async () => {
    await saveBcaTemplate();
    const bytes = fixture("bca-mutasi.csv");
    const again = await upload(Buffer.concat([bytes, Buffer.from("\r\n")]), bcaAccount);
    await applyCsvMapping(h.rizz, { batchId: again.body.batchId!, mapping: { ...suggestionFor(bytes), balanceColumn: null }, saveTemplate: true }, { today: TODAY });
    const [template] = await testDb.select().from(importTemplates);
    expect(template!.version).toBe(2);
    const audit = await testDb.select().from(auditLog).where(eq(auditLog.entityId, template!.id));
    const update = audit.find((a) => a.action === "update");
    expect(update!.diff).toMatchObject({ mapping: [expect.objectContaining({ balanceColumn: "Saldo" }), expect.objectContaining({ balanceColumn: null })] });
  });
});

describe("penolakan", () => {
  it("file sama yang sudah committed ditolak dengan tautan ke hasil impor sebelumnya", async () => {
    const bytes = fixture("debit-kredit-id.csv");
    const { body } = await upload(bytes, bcaAccount);
    await testDb.update(importBatches).set({ status: "committed" }).where(eq(importBatches.id, body.batchId!));
    const again = await upload(bytes, bcaAccount);
    expect(again.status).toBe(409);
    expect(again.body.code).toBe("already_imported");
    expect(again.body.error).toMatch(/^File ini sudah diimpor pada .+\. Lihat hasil impornya\.$/);
    expect(again.body.href).toBe(`/impor/${body.batchId}`);
  });

  it("akun tunai bukan tujuan impor", async () => {
    const cash = await createAccountRow(testDb, { name: "Tunai", type: "cash", ownerId: h.rizz.user.id });
    const { status, body } = await upload(fixture("debit-kredit-id.csv"), cash.id);
    expect(status).toBe(400);
    expect(body.error).toBe("Impor mutasi hanya untuk akun bank, e-wallet, atau kartu kredit. Pilih akun lain.");
  });

  it("tipe dari isi file: biner dan Excel ditolak walau namanya .csv", async () => {
    const binary = await upload(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x01]), bcaAccount, "mutasi.csv");
    expect(binary.status).toBe(415);
    const xlsx = await upload(Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]), bcaAccount, "mutasi.csv");
    expect(xlsx.body.error).toBe("File Excel belum bisa dibaca. Simpan sebagai CSV dari Excel lalu unggah lagi.");
    expect(await testDb.select().from(importBatches)).toHaveLength(0);
  });

  it("teks satu kolom bukan tabel CSV", async () => {
    const { status, body } = await upload(Buffer.from("halo\ndunia\n"), bcaAccount);
    expect(status).toBe(400);
    expect(body.error).toBe("File ini tidak terbaca sebagai tabel CSV. Pilih file CSV atau PDF mutasi dari bank.");
  });

  it("file lebih dari 20 MB ditolak", async () => {
    const big = Buffer.alloc(20 * 1024 * 1024 + 1, 0x61);
    const { status, body } = await upload(big, bcaAccount);
    expect(status).toBe(413);
    expect(body.error).toBe("File lebih dari 20 MB. Unduh mutasi per bulan lalu unggah satu per satu.");
  });

  it("tanpa sesi ditolak", async () => {
    session.viewer = null;
    const { status } = await upload(fixture("debit-kredit-id.csv"), bcaAccount);
    expect(status).toBe(401);
  });
});

describe("file sementara", () => {
  it("pembersihan menghapus file lebih tua dari 7 hari", async () => {
    const { body } = await upload(fixture("debit-kredit-id.csv"), bcaAccount);
    const path = importFilePath(body.batchId!, "csv", dir);
    expect(await cleanupImportFiles(7, new Date())).toBe(0);
    expect(existsSync(path)).toBe(true);
    expect(await cleanupImportFiles(7, new Date(Date.now() + 8 * 24 * 60 * 60 * 1000))).toBeGreaterThanOrEqual(1);
    expect(existsSync(path)).toBe(false);
  });
});
