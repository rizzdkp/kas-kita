import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { closeDb, resetDb, testDb } from "../helpers/db";
import { createAccountRow, createHousehold, insertTx, seedBasicCategories, type Household } from "../helpers/fixtures";
import { uuidv7 } from "@/lib/uuid";
import { cleanupOrphanAttachments } from "@/server/attachments/cleanup";
import { attachments, auditLog } from "@/server/db/schema";
import { enqueuePdfAi, fetchPdfAiJobForTest, stopQueueClient } from "@/server/jobs/queue";
import { handlePdfAiJob } from "@/worker/jobs/pdf-ai";

let dir: string;
let h: Household;
const NOW = new Date("2026-09-24T03:30:00+07:00");
const DAY = 24 * 60 * 60 * 1000;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "kaskita-cleanup-"));
  process.env.ATTACHMENTS_DIR = dir;
});

afterAll(async () => {
  rmSync(dir, { recursive: true, force: true });
  await stopQueueClient();
  await closeDb();
});

beforeEach(async () => {
  await resetDb();
  h = await createHousehold(testDb);
});

async function attachment(opts: { ageDays: number; transactionId?: string; deleted?: boolean }) {
  const id = uuidv7();
  const storageKey = `2026/09/${id}.jpg`;
  const path = join(dir, storageKey);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, "jpeg");
  const createdAt = new Date(NOW.getTime() - opts.ageDays * DAY);
  await testDb.insert(attachments).values({
    id,
    storageKey,
    mime: "image/jpeg",
    sizeBytes: 4,
    sha256: "0".repeat(64),
    uploadedBy: h.nadia.user.id,
    transactionId: opts.transactionId ?? null,
    deletedAt: opts.deleted ? createdAt : null,
    createdAt,
  });
  return { id, path };
}

describe("cleanupOrphanAttachments (03:30 WIB)", () => {
  it("hanya lampiran pratinjau yatim > 7 hari yang dihapus lunak (dengan audit) dan filenya dihapus", async () => {
    const account = await createAccountRow(testDb, { name: "Tunai", type: "cash", ownerId: h.nadia.user.id, openingBalance: 100_000n });
    const { food } = await seedBasicCategories(testDb);
    const tx = await insertTx(testDb, { kind: "expense", categoryId: food.id, amount: 5_000n, accountId: account.id, occurredAt: "2026-09-01T10:00:00+07:00", createdBy: h.nadia.user.id });
    const old = await attachment({ ageDays: 8 });
    const fresh = await attachment({ ageDays: 6 });
    const linked = await attachment({ ageDays: 30, transactionId: tx.id });

    expect(await cleanupOrphanAttachments(NOW, testDb)).toEqual({ removed: 1, failed: 0 });

    const rows = await testDb.select().from(attachments);
    const byId = new Map(rows.map((r) => [r.id, r]));
    expect(byId.get(old.id)!.deletedAt).not.toBeNull();
    expect(byId.get(fresh.id)!.deletedAt).toBeNull();
    expect(byId.get(linked.id)!.deletedAt).toBeNull();
    expect(existsSync(old.path)).toBe(false);
    expect(existsSync(fresh.path)).toBe(true);
    expect(existsSync(linked.path)).toBe(true);

    const audit = await testDb.select().from(auditLog).where(and(eq(auditLog.entity, "attachments"), eq(auditLog.entityId, old.id)));
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ actorId: h.nadia.user.id, action: "delete" });
  });

  it("pemanggilan ulang tidak menyentuh lampiran yang sudah dihapus", async () => {
    await attachment({ ageDays: 10, deleted: true });
    expect(await cleanupOrphanAttachments(NOW, testDb)).toEqual({ removed: 0, failed: 0 });
  });
});

describe("antrean import.pdf-ai (pg-boss di database yang sama)", () => {
  it("app mengirim job berisi batchId + teks; worker menolak payload yang bentuknya salah", async () => {
    const batchId = uuidv7();
    await enqueuePdfAi({ batchId, pages: ["HALAMAN SATU"] });
    const job = await fetchPdfAiJobForTest();
    expect(job).toEqual({ batchId, pages: ["HALAMAN SATU"] });

    vi.spyOn(console, "log").mockImplementation(() => {});
    expect(await handlePdfAiJob({ batchId: "bukan-uuid", pages: [] })).toBe("skipped");
    expect(await handlePdfAiJob({ batchId, pages: "bukan array" })).toBe("skipped");
    vi.restoreAllMocks();
  });
});
