import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { addDaysKey } from "@/server/metrics/_time";
import { todayJakarta } from "@/lib/dates";
import { db, sql } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { createAccount } from "@/server/mutations/accounts";

// hanya untuk e2e impor CSV: akun bank kosong "E2E Impor CSV …" supaya dedupe tidak bercampur data seed; dibersihkan e2e-cleanup
if (process.env.NODE_ENV === "production") throw new Error("helper e2e tidak boleh dipakai di produksi");

const [rizz] = await db.select().from(users).where(eq(users.email, "rizz@kaskita.local"));
if (!rizz) throw new Error("User seed tidak ada");
const token = randomBytes(3).toString("hex").replace(/\d/g, (d) => "abcdefghij"[Number(d)]!);
const name = `E2E Impor CSV ${token}`;
const account = await createAccount(
  { user: rizz, partner: null, sessionId: "e2e" },
  { name, type: "bank", ownerId: rizz.id, openingBalance: 5_000_000n, openingDate: addDaysKey(todayJakarta(), -120) },
);
console.log(JSON.stringify({ accountId: account.id, name }));
await sql.end();
