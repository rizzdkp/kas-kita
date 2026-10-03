import { describe, expect, it } from "vitest";
import {
  changedFields,
  fromLocalInput,
  initialValues,
  mapFieldErrors,
  parseTags,
  toLocalInput,
  toSubmitFields,
  type FormValues,
} from "@/components/transactions/form-values";
import type { TransactionFormInitial, TransactionFormOptions } from "@/components/transactions/types";

const ME = "0190a1b2-0000-7000-8000-000000000001";
const PARTNER = "0190a1b2-0000-7000-8000-000000000002";
const ACC_ME = "0190a1b2-0000-7000-8000-00000000a001";
const ACC_PARTNER = "0190a1b2-0000-7000-8000-00000000a002";
const ACC_SHARED = "0190a1b2-0000-7000-8000-00000000a003";
const CAT_FOOD = "0190a1b2-0000-7000-8000-00000000c001";
const CAT_COFFEE = "0190a1b2-0000-7000-8000-00000000c002";
const CAT_SALARY = "0190a1b2-0000-7000-8000-00000000c003";

const OPTIONS: TransactionFormOptions = {
  accounts: [
    { id: ACC_ME, name: "BCA Rizz", type: "bank", ownerId: ME, archived: false },
    { id: ACC_PARTNER, name: "GoPay Nadia", type: "ewallet", ownerId: PARTNER, archived: false },
    { id: ACC_SHARED, name: "Rekening Bersama", type: "bank", ownerId: null, archived: false },
  ],
  categories: {
    expense: [{ id: CAT_FOOD, name: "Makan dan minum", icon: "utensils", children: [{ id: CAT_COFFEE, name: "Kopi", icon: "coffee" }] }],
    income: [{ id: CAT_SALARY, name: "Gaji", icon: "wallet", children: [] }],
  },
  people: { me: { id: ME, name: "Rizz", color: "violet" }, partner: { id: PARTNER, name: "Nadia", color: "ocean" } },
  defaults: { accountId: null, categoryId: null },
};

const EXISTING: TransactionFormInitial = {
  id: "0190a1b2-0000-7000-8000-00000000f001",
  version: 3,
  kind: "expense",
  amount: 25_000n,
  accountId: ACC_ME,
  toAccountId: null,
  categoryId: CAT_COFFEE,
  // 23.30 WIB supaya pembulatan zona waktu ikut teruji
  occurredAt: new Date("2026-09-23T23:30:00+07:00"),
  note: "kopi susu",
  beneficiary: "owner",
  tagNames: ["kantor", "pagi"],
};

/** Buka form edit, terapkan perubahan pengguna, lalu hitung patch seperti TransactionForm. */
function editPatch(change: Partial<FormValues>) {
  const start = initialValues(OPTIONS, "me", EXISTING);
  const base = toSubmitFields(start, OPTIONS, EXISTING.beneficiary).fields;
  const values = { ...start, ...change };
  const next = toSubmitFields(values, OPTIONS, EXISTING.beneficiary).fields;
  if (!next) throw new Error("form tidak valid");
  return changedFields(next, values, start, base);
}

describe("changedFields: hanya field yang berubah dikirim saat edit", () => {
  it("tanpa perubahan, patch kosong", () => {
    expect(editPatch({})).toEqual({});
  });

  it("nominal berubah", () => {
    expect(editPatch({ amountText: "30rb" })).toEqual({ amount: 30_000n });
  });

  it("nominal ditulis ulang dengan format lain tapi nilainya sama, tidak dikirim", () => {
    expect(editPatch({ amountText: "25000" })).toEqual({});
    expect(editPatch({ amountText: "25rb" })).toEqual({});
  });

  it("catatan hanya spasi tambahan tidak dikirim; dikosongkan dikirim null", () => {
    expect(editPatch({ note: "  kopi susu  " })).toEqual({});
    expect(editPatch({ note: "   " })).toEqual({ note: null });
  });

  it("tag diurutkan ulang atau diduplikasi tidak dikirim; tag baru dikirim lengkap", () => {
    expect(editPatch({ tagsText: "pagi, kantor, pagi" })).toEqual({});
    expect(editPatch({ tagsText: "kantor, pagi, liburan" })).toEqual({ tagNames: ["kantor", "pagi", "liburan"] });
  });

  it("waktu hanya dikirim kalau input tanggal diubah", () => {
    expect(editPatch({ occurredLocal: "2026-09-23T23:45" })).toEqual({ occurredAt: new Date("2026-09-23T23:45:00+07:00") });
  });

  it("ganti kategori dan akun sekaligus hanya mengirim keduanya", () => {
    expect(editPatch({ categoryId: CAT_FOOD, accountId: ACC_SHARED, beneficiary: "shared" })).toEqual({
      categoryId: CAT_FOOD,
      accountId: ACC_SHARED,
    });
  });

  it("untuk siapa berubah dari saya ke partner", () => {
    expect(editPatch({ beneficiary: "partner" })).toEqual({ beneficiary: "partner_of_owner" });
  });

  it("ubah jadi transfer mengirim jenis, akun tujuan, dan kategori null", () => {
    expect(editPatch({ kind: "transfer", toAccountId: ACC_SHARED })).toEqual({
      kind: "transfer",
      toAccountId: ACC_SHARED,
      categoryId: null,
    });
  });

  it("mode tambah (tanpa base) mengirim semua field", () => {
    const start = initialValues(OPTIONS, "me", undefined, new Date("2026-09-24T10:00:00+07:00"));
    const values: FormValues = { ...start, amountText: "12rb", categoryId: CAT_COFFEE };
    const next = toSubmitFields(values, OPTIONS, undefined).fields!;
    expect(changedFields(next, values, start, null)).toEqual(next);
    expect(next).toMatchObject({ kind: "expense", amount: 12_000n, accountId: ACC_ME, beneficiary: "owner", tagNames: [] });
  });
});

describe("nilai awal dan validasi form", () => {
  it("nilai awal edit memakai WIB dan nominal bertitik", () => {
    const v = initialValues(OPTIONS, "me", EXISTING);
    expect(v).toMatchObject({ amountText: "25.000", occurredLocal: "2026-09-23T23:30", beneficiary: "me", tagsText: "kantor, pagi" });
  });

  it("akun bawaan mengikuti cakupan", () => {
    expect(initialValues(OPTIONS, "partner", undefined).accountId).toBe(ACC_PARTNER);
    expect(initialValues(OPTIONS, "me", undefined).accountId).toBe(ACC_ME);
  });

  it("datetime-local bolak-balik tetap di WIB", () => {
    const d = new Date("2026-09-23T16:30:00Z");
    expect(toLocalInput(d)).toBe("2026-09-23T23:30");
    expect(fromLocalInput("2026-09-23T23:30")?.toISOString()).toBe("2026-09-23T16:30:00.000Z");
    expect(fromLocalInput("")).toBeNull();
  });

  it("menolak nominal kosong, kategori kosong, dan transfer ke akun yang sama", () => {
    const start = initialValues(OPTIONS, "me", EXISTING);
    expect(toSubmitFields({ ...start, amountText: "", categoryId: "" }, OPTIONS, undefined).errors).toEqual({
      amount: "Isi nominal, misalnya 25rb",
      categoryId: "Pilih kategori",
    });
    expect(toSubmitFields({ ...start, kind: "transfer", toAccountId: ACC_ME }, OPTIONS, undefined).errors).toEqual({
      toAccountId: "Akun tujuan harus berbeda dari akun asal",
    });
  });

  it("tag dirapikan dan unik", () => {
    expect(parseTags(" a, b ,, a ,c ")).toEqual(["a", "b", "c"]);
  });

  it("kunci galat server dipetakan ke field form", () => {
    expect(mapFieldErrors({ "patch.amount": ["Terlalu besar"], "tagNames.0": ["Tag terlalu panjang"], note: ["x", "y"] })).toEqual({
      amount: "Terlalu besar",
      tags: "Tag terlalu panjang",
      note: "x",
    });
  });
});
