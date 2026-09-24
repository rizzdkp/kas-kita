import { afterAll, describe, expect, it } from "vitest";
import { parseQuickAdd, type QuickAddContext } from "@/lib/quick-add-parser";

const wib = (iso: string) => new Date(`${iso}+07:00`);
// Kamis, 24 Sep 2026 09.12 WIB
const NOW = wib("2026-09-24T09:12:00");

const EXPENSE = [
  "Makan dan minum", "Belanja dapur", "Makan di luar", "Kopi dan jajan", "Bensin", "Ojek dan taksi",
  "Parkir dan tol", "Sewa atau cicilan", "Listrik", "Air", "Internet", "Tagihan dan langganan", "Hiburan", "Lainnya",
];
const INCOME = ["Gaji", "Bonus", "Usaha sampingan", "Pengembalian dana", "Lainnya"];
const catId = (kind: "income" | "expense", name: string) => `${kind}:${name}`;

const ctx: QuickAddContext = {
  now: NOW,
  accounts: [
    { id: "acc-bca", name: "BCA" },
    { id: "acc-jago", name: "Bank Jago" },
    { id: "acc-gopay", name: "GoPay" },
    { id: "acc-cash", name: "Tunai" },
    { id: "acc-cc", name: "Kartu Kredit Mandiri", aliases: ["cc"] },
  ],
  categories: [
    ...EXPENSE.map((name) => ({ id: catId("expense", name), name, kind: "expense" as const })),
    ...INCOME.map((name) => ({ id: catId("income", name), name, kind: "income" as const })),
    { id: "custom-anak", name: "Anak", kind: "expense", keywords: ["popok", "susu anak"] },
  ],
};

const one = (input: string, c: QuickAddContext = ctx) => {
  const drafts = parseQuickAdd(input, c);
  expect(drafts).toHaveLength(1);
  return drafts[0]!;
};

describe("contoh PRD F-IN-2", () => {
  it("kopi 25rb gopay", () => {
    const d = one("kopi 25rb gopay");
    expect(d).toMatchObject({
      raw: "kopi 25rb gopay",
      kind: "expense",
      amount: 25_000n,
      accountId: "acc-gopay",
      toAccountId: null,
      categoryId: catId("expense", "Kopi dan jajan"),
      note: "Kopi",
      beneficiary: "owner",
      missing: [],
    });
    expect(d.occurredAt.getTime()).toBe(NOW.getTime());
  });

  it("gaji 8,5jt bca kemarin", () => {
    const d = one("gaji 8,5jt bca kemarin");
    expect(d).toMatchObject({
      kind: "income",
      amount: 8_500_000n,
      accountId: "acc-bca",
      categoryId: catId("income", "Gaji"),
      note: "Gaji",
      missing: [],
    });
    expect(d.occurredAt.getTime()).toBe(wib("2026-09-23T09:12:00").getTime());
  });

  it("listrik 500rb bca untuk bersama", () => {
    const d = one("listrik 500rb bca untuk bersama");
    expect(d).toMatchObject({
      kind: "expense",
      amount: 500_000n,
      accountId: "acc-bca",
      categoryId: catId("expense", "Listrik"),
      beneficiary: "shared",
      note: "Listrik",
      missing: [],
    });
  });
});

describe("beberapa baris", () => {
  it("satu draf per baris tidak kosong", () => {
    const drafts = parseQuickAdd("kopi 25rb gopay\n\n  \r\nbensin 50rb tunai\nparkir 5rb", ctx);
    expect(drafts.map((d) => d.raw)).toEqual(["kopi 25rb gopay", "bensin 50rb tunai", "parkir 5rb"]);
    expect(drafts[1]).toMatchObject({ amount: 50_000n, accountId: "acc-cash", categoryId: catId("expense", "Bensin") });
    expect(drafts[2]).toMatchObject({ amount: 5_000n, accountId: null, categoryId: catId("expense", "Parkir dan tol") });
    expect(drafts[2]!.missing).toEqual(["account"]);
  });

  it("input kosong menghasilkan daftar kosong", () => {
    expect(parseQuickAdd("", ctx)).toEqual([]);
    expect(parseQuickAdd("\n \n", ctx)).toEqual([]);
  });
});

describe("transfer", () => {
  it("transfer 1jt bca ke jago", () => {
    const d = one("transfer 1jt bca ke jago");
    expect(d).toMatchObject({
      kind: "transfer", amount: 1_000_000n, accountId: "acc-bca", toAccountId: "acc-jago",
      categoryId: null, note: null, missing: [],
    });
  });

  it("tf dari jago ke bca", () => {
    expect(one("tf 500rb dari jago ke bca")).toMatchObject({ kind: "transfer", accountId: "acc-jago", toAccountId: "acc-bca" });
  });

  it("tanpa kata transfer tapi pola akun ke akun", () => {
    expect(one("1jt bca ke jago")).toMatchObject({ kind: "transfer", accountId: "acc-bca", toAccountId: "acc-jago" });
  });

  it("topup gopay dari bca", () => {
    expect(one("topup gopay 100rb dari bca")).toMatchObject({ kind: "transfer", accountId: "acc-bca", toAccountId: "acc-gopay" });
  });

  it("transfer tanpa akun tujuan menandai account", () => {
    const d = one("tf 1jt bca");
    expect(d.kind).toBe("transfer");
    expect(d.missing).toEqual(["account"]);
  });
});

describe("field kosong ditandai (AC5)", () => {
  it("tanpa akun dan tanpa default", () => {
    const d = one("kopi 25rb");
    expect(d.accountId).toBeNull();
    expect(d.missing).toEqual(["account"]);
  });

  it("tanpa akun memakai defaultAccountId kalau ada", () => {
    expect(one("kopi 25rb", { ...ctx, defaultAccountId: "acc-jago" })).toMatchObject({ accountId: "acc-jago", missing: [] });
  });

  it("tanpa nominal", () => {
    const d = one("kopi gopay");
    expect(d.amount).toBeNull();
    expect(d.missing).toEqual(["amount"]);
  });

  it("tanpa kategori yang dikenali", () => {
    const d = one("sesuatu 40rb bca");
    expect(d).toMatchObject({ kind: "expense", categoryId: null, note: "Sesuatu" });
    expect(d.missing).toEqual(["category"]);
  });

  it("input sampah tidak melempar dan menandai semua field", () => {
    const d = one("asdf qwerty ;;; ###");
    expect(d.kind).toBeNull();
    expect(d.missing).toEqual(["amount", "account", "category", "kind"]);
    expect(d.note).toBe("Asdf qwerty ;;; ###");
  });

  it.each(["\u0000\u0001", "\u{1F4A5}\u{1F4A5}", "rp rp rp", "ke ke ke", "untuk", "tgl", "12/99", "9".repeat(200), "a".repeat(2000)])(
    "tidak melempar untuk %j",
    (input) => {
      expect(() => parseQuickAdd(input, ctx)).not.toThrow();
    },
  );

  it("ctx dengan now tidak valid tetap tidak melempar", () => {
    expect(() => parseQuickAdd("kopi 25rb", { ...ctx, now: new Date(Number.NaN) })).not.toThrow();
  });
});

describe("nominal", () => {
  it.each([
    ["makan siang 45.000 bca", 45_000n],
    ["makan Rp 45.000 bca", 45_000n],
    ["makan 1,5 juta bca", 1_500_000n],
    ["makan 25 rb bca", 25_000n],
    ["makan 25k bca", 25_000n],
    ["makan 2 porsi 50rb bca", 50_000n],
  ])("%s", (input, amount) => {
    expect(one(input).amount).toBe(amount);
  });

  it("angka tanpa sufiks yang lain tetap di catatan", () => {
    expect(one("makan 2 porsi 50rb bca").note).toBe("Makan 2 porsi");
  });

  it("negatif tetap disimpan positif", () => {
    expect(one("kopi -25rb gopay").amount).toBe(25_000n);
  });
});

describe("tanggal relatif", () => {
  const dayOf = (input: string) => {
    const d = one(input);
    return new Date(d.occurredAt.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
  };

  it.each([
    ["kopi 25rb gopay hari ini", "2026-09-24"],
    ["kopi 25rb gopay kemarin", "2026-09-23"],
    ["kopi 25rb gopay kmrn", "2026-09-23"],
    ["kopi 25rb gopay kemarin lusa", "2026-09-22"],
    ["kopi 25rb gopay senin", "2026-09-21"],
    ["kopi 25rb gopay hari senin", "2026-09-21"],
    ["kopi 25rb gopay rabu", "2026-09-23"],
    ["kopi 25rb gopay kamis", "2026-09-17"],
    ["kopi 25rb gopay jumat", "2026-09-18"],
    ["kopi 25rb gopay tgl 12", "2026-09-12"],
    ["kopi 25rb gopay tgl 28", "2026-08-28"],
    ["kopi 25rb gopay 12 sep", "2026-09-12"],
    ["kopi 25rb gopay 12 agustus", "2026-08-12"],
    ["kopi 25rb gopay 5 des", "2025-12-05"],
    ["kopi 25rb gopay 5 des 2026", "2026-12-05"],
    ["kopi 25rb gopay 12/9", "2026-09-12"],
    ["kopi 25rb gopay 31/8/2026", "2026-08-31"],
    ["kopi 25rb gopay tgl 31 feb", "2026-02-28"],
  ])("%s -> %s", (input, day) => {
    expect(dayOf(input)).toBe(day);
  });

  it("kata tanggal dibuang dari catatan, lusa tidak dianggap tanggal", () => {
    expect(one("kopi 25rb gopay tgl 12").note).toBe("Kopi");
    expect(one("kopi 25rb gopay hari senin").note).toBe("Kopi");
    const lusa = one("kopi 25rb gopay lusa");
    expect(lusa.note).toBe("Kopi lusa");
    expect(lusa.occurredAt.getTime()).toBe(NOW.getTime());
  });

  it("jam 23.30 WIB tetap tanggal WIB", () => {
    const late = wib("2026-09-24T23:30:00");
    const d = one("kopi 25rb gopay kemarin", { ...ctx, now: late });
    expect(d.occurredAt.getTime()).toBe(wib("2026-09-23T23:30:00").getTime());
  });
});

describe("akun", () => {
  it.each([
    ["kopi 25rb GoPay", "acc-gopay"],
    ["kopi 25rb go-pay", "acc-gopay"],
    ["kopi 25rb pakai gopay", "acc-gopay"],
    ["kopi 25rb jago", "acc-jago"],
    ["kopi 25rb bank jago", "acc-jago"],
    ["kopi 25rb cash", "acc-cash"],
    ["kopi 25rb tunai", "acc-cash"],
    ["kopi 25rb cc", "acc-cc"],
    ["kopi 25rb mandiri", "acc-cc"],
  ])("%s -> %s", (input, id) => {
    const d = one(input);
    expect(d.accountId).toBe(id);
    expect(d.note).toBe("Kopi");
  });

  it("kata umum seperti bank saja tidak cocok ke akun", () => {
    expect(one("kopi 25rb bank").accountId).toBeNull();
  });

  it("satu kata yang cocok ke beberapa akun memilih urutan pertama ctx", () => {
    const c = { ...ctx, accounts: [{ id: "a1", name: "BCA Rizz" }, { id: "a2", name: "BCA Nadia" }] };
    expect(one("kopi 25rb bca", c).accountId).toBe("a1");
    expect(one("kopi 25rb bca nadia", c).accountId).toBe("a2");
  });
});

describe("jenis, kategori, dan untuk siapa", () => {
  it.each([
    ["bonus 2jt bca", "income", catId("income", "Bonus")],
    ["cashback 15rb gopay", "income", catId("income", "Pengembalian dana")],
    ["refund 100rb bca", "income", catId("income", "Pengembalian dana")],
    ["terima 300rb bca", "income", null],
    ["makan siang 45rb bca", "expense", catId("expense", "Makan di luar")],
    ["gojek 20rb gopay", "expense", catId("expense", "Ojek dan taksi")],
    ["indomaret 80rb bca", "expense", catId("expense", "Belanja dapur")],
    ["netflix 186rb bca", "expense", catId("expense", "Tagihan dan langganan")],
    ["indihome 350rb bca", "expense", catId("expense", "Internet")],
    ["kos 1,5jt bca", "expense", catId("expense", "Sewa atau cicilan")],
    ["tol 20rb bca", "expense", catId("expense", "Parkir dan tol")],
    ["hiburan 100rb bca", "expense", catId("expense", "Hiburan")],
    ["popok 120rb bca", "expense", "custom-anak"],
    ["susu anak 90rb bca", "expense", "custom-anak"],
  ])("%s", (input, kind, categoryId) => {
    const d = one(input);
    expect(d.kind).toBe(kind);
    expect(d.categoryId).toBe(categoryId);
  });

  it("kamus bawaan dilewati kalau kategori seed tidak ada di ctx", () => {
    const c = { ...ctx, categories: ctx.categories.filter((x) => x.name !== "Kopi dan jajan") };
    const d = one("kopi 25rb gopay", c);
    expect(d.categoryId).toBeNull();
    expect(d.missing).toEqual(["category"]);
  });

  it("untuk partner hanya dikenali kalau partnerName ada", () => {
    expect(one("makan 50rb bca untuk nadia").beneficiary).toBe("owner");
    expect(one("makan 50rb bca untuk nadia").note).toBe("Makan untuk nadia");
    const d = one("makan 50rb bca buat Nadia", { ...ctx, partnerName: "Nadia Putri" });
    expect(d.beneficiary).toBe("partner_of_owner");
    expect(d.note).toBe("Makan");
  });

  it("buat bersama dan untuk saya", () => {
    expect(one("belanja 300rb bca buat bersama").beneficiary).toBe("shared");
    expect(one("belanja 300rb bca untuk saya").beneficiary).toBe("owner");
  });
});

describe("tidak bergantung TZ proses", () => {
  const original = process.env.TZ;
  afterAll(() => {
    process.env.TZ = original;
  });

  it.each(["UTC", "America/Los_Angeles"])("%s", (tz) => {
    process.env.TZ = tz;
    const late = wib("2026-09-24T23:30:00");
    const d = one("gaji 8,5jt bca senin", { ...ctx, now: late });
    expect(d.occurredAt.getTime()).toBe(wib("2026-09-21T23:30:00").getTime());
    const t = one("kopi 25rb gopay tgl 24", { ...ctx, now: late });
    expect(t.occurredAt.getTime()).toBe(late.getTime());
  });
});
