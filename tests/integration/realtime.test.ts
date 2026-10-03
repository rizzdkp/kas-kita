import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb, resetDb, testDb } from "../helpers/db";
import { createHousehold, type Household } from "../helpers/fixtures";
import { sql } from "@/server/db/client";
import { createAccount } from "@/server/mutations/accounts";
import type { ChangeEvent } from "@/server/realtime/publish";
import { changeListenerCount, subscribeChanges } from "@/server/realtime/listener";

let h: Household;

beforeEach(async () => {
  await resetDb();
  h = await createHousehold(testDb);
});

afterAll(async () => {
  await sql.end({ timeout: 5 });
  await closeDb();
});

async function waitFor<T>(get: () => T | undefined, ms = 3_000): Promise<T> {
  const until = Date.now() + ms;
  for (;;) {
    const v = get();
    if (v !== undefined) return v;
    if (Date.now() > until) throw new Error("event tidak datang");
    await new Promise((r) => setTimeout(r, 25));
  }
}

describe("LISTEN/NOTIFY (ARCHITECTURE 8)", () => {
  it("mutasi mengirim {entity, id} setelah commit ke semua pendengar lewat satu koneksi", async () => {
    const a: ChangeEvent[] = [];
    const b: ChangeEvent[] = [];
    const stopA = await subscribeChanges((e) => a.push(e));
    const stopB = await subscribeChanges((e) => b.push(e));
    expect(changeListenerCount()).toBe(2);

    const account = await createAccount(h.rizz, { name: "GoPay Rizz", type: "ewallet", ownerId: h.rizz.user.id, openingDate: "2026-09-01" }, testDb);
    const hit = await waitFor(() => a.find((e) => e.id === account.id));
    expect(hit).toEqual({ entity: "accounts", id: account.id });
    await waitFor(() => b.find((e) => e.id === account.id));

    stopA();
    stopB();
    expect(changeListenerCount()).toBe(0);
  });

  it("mutasi yang di-rollback tidak mengirim event", async () => {
    const got: ChangeEvent[] = [];
    const stop = await subscribeChanges((e) => got.push(e));
    let createdId: string | null = null;
    await testDb
      .transaction(async (tx) => {
        const row = await createAccount(h.rizz, { name: "Batal", type: "cash", ownerId: h.rizz.user.id, openingDate: "2026-09-01" }, tx);
        createdId = row.id;
        throw new Error("batal");
      })
      .catch(() => undefined);
    // event penanda setelahnya membuktikan antrean NOTIFY sudah terkirim
    const marker = await createAccount(h.rizz, { name: "Penanda", type: "cash", ownerId: h.rizz.user.id, openingDate: "2026-09-01" }, testDb);
    await waitFor(() => got.find((e) => e.id === marker.id));
    expect(createdId).not.toBeNull();
    expect(got.some((e) => e.id === createdId)).toBe(false);
    stop();
  });
});
