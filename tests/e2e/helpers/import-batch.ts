import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, sql } from "@/server/db/client";
import { importRows, users } from "@/server/db/schema";
import { todayJakarta } from "@/lib/dates";
import { createImportBatch, saveParsedRows } from "@/server/import/pipeline";
import type { ParsedRow } from "@/server/import/types";
import { createAccount } from "@/server/mutations/accounts";
import { commitImportBatch } from "@/server/mutations/import-commit";
import { createTransaction } from "@/server/mutations/transactions";
import { listCategories } from "@/server/queries/categories";
import { addDaysKey } from "@/server/metrics/_time";

// hanya untuk e2e layar tinjau: menyiapkan batch lewat pipeline langsung, tanpa UI unggah
// akun "E2E Impor …" dan transaksinya dibersihkan e2e-cleanup
if (process.env.NODE_ENV === "production") throw new Error("helper e2e tidak boleh dipakai di produksi");

const [rizz] = await db.select().from(users).where(eq(users.email, "rizz@kaskita.local"));
const [nadia] = await db.select().from(users).where(eq(users.email, "nadia@kaskita.local"));
if (!rizz) throw new Error("User seed tidak ada");
const viewer = { user: rizz, partner: nadia ?? null, sessionId: "e2e" };

const token = randomBytes(3).toString("hex").replace(/\d/g, (d) => "abcdefghij"[Number(d)]!);
const today = todayJakarta();
const day = (n: number) => addDaysKey(today, -n);
const sha = () => randomBytes(32).toString("hex");
const row = (date: string, description: string, amount: bigint, raw: Record<string, string> = {}): ParsedRow => ({
  date,
  time: null,
  description,
  amount,
  balance: null,
  raw: { Tanggal: date, Keterangan: description, ...raw },
});

const account = await createAccount(viewer, {
  name: `E2E Impor ${token}`,
  type: "bank",
  ownerId: rizz.id,
  openingBalance: 20_000_000n,
  openingDate: addDaysKey(today, -60),
});
const [expense] = await listCategories({ kind: "expense" });
if (!expense) throw new Error("Kategori seed tidak ada");

// transaksi manual yang nanti muncul sebagai pembanding Kemungkinan duplikat
const manual = await createTransaction(viewer, {
  kind: "expense",
  amount: 120_000n,
  accountId: account.id,
  categoryId: expense.id,
  occurredAt: new Date(`${day(2)}T19:00:00+07:00`),
  note: `Belanja Indomaret ${token}`,
});

// impor sebelumnya yang sudah disimpan: dasar Duplikat pasti
const earlier = await createImportBatch(viewer, { accountId: account.id, institutionId: null, format: "csv", fileSha256: sha() });
await saveParsedRows(viewer, earlier.id, [row(day(6), `PARKIR LAMA ${token}`, -5_000n)]);
const [earlierRow] = await db.select().from(importRows).where(eq(importRows.batchId, earlier.id));
await commitImportBatch(viewer, { batchId: earlier.id, rows: [{ rowId: earlierRow!.id, action: "import", categoryId: expense.id }] });

// token unik di setiap kata supaya baris ini tidak pernah punya saran kategori dari run lain
const unknown = `QX${token} WP${token}`;
const format = process.argv[2] === "ai_pdf" ? "ai_pdf" : "csv";
const batch = await createImportBatch(viewer, { accountId: account.id, institutionId: null, format, fileSha256: sha() });
await saveParsedRows(viewer, batch.id, [
  row(day(5), `KOPI KENANGAN ${token}`, -54_000n),
  row(day(4), `GAJI PT CONTOH ${token}`, 8_500_000n),
  row(day(4), unknown, -33_000n),
  row(day(3), `INDOMARET ${token}`, -120_000n),
  row(day(6), `PARKIR LAMA ${token}`, -5_000n),
  row(day(1), `BENSIN SHELL ${token}`, -75_000n, { __balanceMismatch: "1" }),
]);

console.log(JSON.stringify({ batchId: batch.id, accountId: account.id, manualId: manual.id, token, unknown }));
await sql.end();
