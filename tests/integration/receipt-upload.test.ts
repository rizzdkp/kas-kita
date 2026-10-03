import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { closeDb, resetDb, testDb } from "../helpers/db";
import { createAccountRow, createHousehold, insertTx, seedBasicCategories, type Household } from "../helpers/fixtures";
import type { Viewer } from "@/server/auth/viewer";
import { attachments, auditLog } from "@/server/db/schema";

const session = vi.hoisted(() => ({ viewer: null as Viewer | null }));
vi.mock("@/server/auth/session", () => ({ getViewerFromHeaders: async () => session.viewer }));

const { POST } = await import("@/app/api/attachments/route");
const { GET } = await import("@/app/api/attachments/[id]/route");

const fixtures = join(process.cwd(), "tests/fixtures/receipts");
const receiptJpeg = readFileSync(join(fixtures, "indomaret.jpg"));
let dir: string;
let h: Household;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "kaskita-lampiran-"));
  process.env.ATTACHMENTS_DIR = dir;
});

afterAll(async () => {
  rmSync(dir, { recursive: true, force: true });
  await closeDb();
});

beforeEach(async () => {
  await resetDb();
  h = await createHousehold(testDb);
  session.viewer = h.rizz;
});

function upload(body: Uint8Array<ArrayBuffer> | Buffer<ArrayBuffer>, query = ""): Promise<Response> {
  return POST(
    new Request(`http://localhost/api/attachments${query}`, {
      method: "POST",
      body,
      headers: { "content-type": "image/jpeg", host: "localhost", origin: "http://localhost" },
    }),
  );
}

describe("POST /api/attachments", () => {
  it("menyimpan JPEG baru tanpa EXIF/GPS dengan baris attachments ber-transaction_id null", async () => {
    const original = await sharp(receiptJpeg).metadata();
    expect(original.exif).toBeDefined();

    const res = await upload(receiptJpeg);
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; width: number; height: number };

    const [row] = await testDb.select().from(attachments).where(eq(attachments.id, body.id));
    expect(row).toMatchObject({ transactionId: null, mime: "image/jpeg", uploadedBy: h.rizz.user.id });
    expect(row!.storageKey).toMatch(new RegExp(`^\\d{4}/\\d{2}/${body.id}\\.jpg$`));
    const stored = readFileSync(join(dir, row!.storageKey));
    expect(row!.sizeBytes).toBe(stored.length);
    const meta = await sharp(stored).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.exif).toBeUndefined();
    expect(Math.max(meta.width, meta.height)).toBeLessThanOrEqual(1600);
    expect((await testDb.select().from(auditLog).where(eq(auditLog.entity, "attachments"))).map((a) => a.action)).toEqual(["insert"]);
  });

  it("menolak file teks yang namanya diganti .jpg lewat magic bytes", async () => {
    const res = await upload(readFileSync(join(fixtures, "bukan-gambar.jpg")));
    expect(res.status).toBe(415);
    expect(((await res.json()) as { error: string }).error).toContain("bukan foto");
    expect(await testDb.select().from(attachments)).toHaveLength(0);
  });

  it("menolak file lebih dari 10 MB", async () => {
    const big = new Uint8Array(10 * 1024 * 1024 + 1);
    big.set(receiptJpeg.subarray(0, 3));
    const res = await upload(big);
    expect(res.status).toBe(413);
    expect(await testDb.select().from(attachments)).toHaveLength(0);
  });

  it("tanpa sesi ditolak 401", async () => {
    session.viewer = null;
    expect((await upload(receiptJpeg)).status).toBe(401);
  });

  it("?transaksi= menautkan lampiran ke transaksi yang ada", async () => {
    const cats = await seedBasicCategories(testDb);
    const acc = await createAccountRow(testDb, { name: "BCA", type: "bank", ownerId: h.rizz.user.id, openingBalance: 100_000n });
    const tx = await insertTx(testDb, { kind: "expense", amount: 10_000n, accountId: acc.id, categoryId: cats.food.id, occurredAt: new Date(), createdBy: h.rizz.user.id });
    const res = await upload(receiptJpeg, `?transaksi=${tx.id}`);
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; transactionId: string };
    expect(body.transactionId).toBe(tx.id);
  });
});

describe("GET /api/attachments/[id]", () => {
  it("menyajikan dengan Cache-Control private hanya untuk sesi valid", async () => {
    const { id } = (await (await upload(receiptJpeg)).json()) as { id: string };
    const get = () => GET(new Request(`http://localhost/api/attachments/${id}`), { params: Promise.resolve({ id }) });
    const ok = await get();
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("image/jpeg");
    expect(ok.headers.get("cache-control")).toMatch(/^private/);
    session.viewer = null;
    expect((await get()).status).toBe(401);
  });
});
