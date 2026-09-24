import { describe, expect, it, vi } from "vitest";
import { parseQuickAdd } from "@/lib/quick-add-parser";
import { applyAiResults, mapAiLine, mapAiOutput, resolveAiAmount, resolveAiDate } from "@/components/quick-add/ai-merge";
import { applyEdit, buildParserContext, draftToItem, missingFields } from "@/components/quick-add/preview-model";
import type { PreviewItem, QuickAddContextData } from "@/components/quick-add/types";
import { buildQuickAddPrompt } from "@/server/ai/prompts/quick-add-v1";
import { quickAddAiJsonSchema, quickAddAiSchema, type QuickAddAiLineOutput } from "@/server/ai/schemas/quick-add";

vi.mock("@/server/actions/quick-add-ai", () => ({ resolveQuickAddWithAi: vi.fn() }));
const { incompleteIndexes } = await import("@/components/quick-add/ai-resolver");

const wib = (iso: string) => new Date(`${iso}+07:00`);
// Kamis, 24 Sep 2026 09.12 WIB
const NOW = wib("2026-09-24T09:12:00");

const ctx: QuickAddContextData = {
  meName: "Rizz",
  partnerName: "Nadia",
  aiAvailable: true,
  accounts: [
    { id: "a-gopay-r", name: "GoPay Rizz", type: "ewallet", owner: "me", ownerName: "Rizz", aliases: ["gopay"] },
    { id: "a-bca-r", name: "BCA Rizz", type: "bank", owner: "me", ownerName: "Rizz", aliases: ["bca"] },
    { id: "a-ovo-n", name: "OVO Nadia", type: "ewallet", owner: "partner", ownerName: "Nadia", aliases: ["ovo"] },
    { id: "a-bersama", name: "Rekening Bersama", type: "bank", owner: "shared", ownerName: null, aliases: [] },
  ],
  categories: [
    { id: "c-kopi", name: "Kopi dan jajan", kind: "expense", parentName: "Makan dan minum" },
    { id: "c-transport", name: "Transportasi", kind: "expense", parentName: null },
    { id: "c-rumah", name: "Rumah", kind: "expense", parentName: null },
    { id: "c-gaji", name: "Gaji", kind: "income", parentName: null },
    { id: "c-lain-in", name: "Lainnya", kind: "income", parentName: null },
  ],
  defaults: { me: "a-gopay-r", partner: "a-ovo-n", all: "a-gopay-r" },
};

function aiLine(partial: Partial<QuickAddAiLineOutput>): QuickAddAiLineOutput {
  return {
    line: 1,
    kind: null,
    amount: null,
    accountName: null,
    toAccountName: null,
    categoryName: null,
    date: null,
    note: null,
    beneficiary: null,
    ...partial,
  };
}

function run(input: string, ai: Array<Partial<QuickAddAiLineOutput>>): PreviewItem[] {
  const parserCtx = buildParserContext(ctx, "me", NOW);
  const drafts = parseQuickAdd(input, parserCtx);
  const items = drafts.map((d, i) => draftToItem(d, `00000000-0000-4000-8000-00000000000${i}`));
  const indexes = incompleteIndexes(drafts);
  const data = mapAiOutput(ai.map((a, i) => aiLine({ line: i + 1, ...a })), indexes.length, ctx, NOW);
  return applyAiResults(items, drafts, indexes, data, ctx, parserCtx);
}

describe("nominal dari AI divalidasi ulang", () => {
  it("menerima integer rupiah dan teks seperti 1,5jt atau 25rb", () => {
    expect(resolveAiAmount(175_000)).toBe(175_000n);
    expect(resolveAiAmount("1,5jt")).toBe(1_500_000n);
    expect(resolveAiAmount("25rb")).toBe(25_000n);
    expect(resolveAiAmount("Rp 25.000")).toBe(25_000n);
  });
  it("pecahan, nol, negatif, dan teks yang bukan nominal dianggap kosong", () => {
    expect(resolveAiAmount(1.5)).toBeNull();
    expect(resolveAiAmount(0)).toBeNull();
    expect(resolveAiAmount(-25_000)).toBeNull();
    expect(resolveAiAmount("-25rb")).toBeNull();
    expect(resolveAiAmount("seratus ribu")).toBeNull();
    expect(resolveAiAmount(Number.MAX_SAFE_INTEGER + 2)).toBeNull();
  });
});

describe("tanggal dari AI", () => {
  it("ISO dan kata relatif memakai jam saat ini", () => {
    expect(resolveAiDate("2026-09-20", NOW)).toEqual(wib("2026-09-20T09:12:00"));
    expect(resolveAiDate("kemarin", NOW)).toEqual(wib("2026-09-23T09:12:00"));
    expect(resolveAiDate("2026-09-24T00:00:00Z", NOW)).toEqual(wib("2026-09-24T09:12:00"));
  });
  it("tanggal masa depan dan tanggal tidak valid ditolak", () => {
    expect(resolveAiDate("2026-09-25", NOW)).toBeNull();
    expect(resolveAiDate("2027-01-01", NOW)).toBeNull();
    expect(resolveAiDate("2026-02-30", NOW)).toBeNull();
    expect(resolveAiDate("besok", NOW)).toBeNull();
  });
});

describe("pemetaan nama ke id", () => {
  it("nama di luar daftar menjadi kosong, nama di daftar dicocokkan tanpa peduli huruf besar", () => {
    const out = mapAiLine(aiLine({ kind: "expense", accountName: "rekening bersama", categoryName: "Otomotif" }), ctx, NOW);
    expect(out.accountId).toBe("a-bersama");
    expect(out.categoryId).toBeNull();
    expect(mapAiLine(aiLine({ accountName: "Mandiri Rizz" }), ctx, NOW).accountId).toBeNull();
  });
  it("kategori yang jenisnya tidak cocok dengan kind dibuang", () => {
    expect(mapAiLine(aiLine({ kind: "income", categoryName: "Transportasi" }), ctx, NOW).categoryId).toBeNull();
  });
  it("transfer tidak punya kategori dan akun tujuan tidak boleh sama dengan akun asal", () => {
    const out = mapAiLine(aiLine({ kind: "transfer", accountName: "BCA Rizz", toAccountName: "BCA Rizz", categoryName: "Rumah" }), ctx, NOW);
    expect(out.categoryId).toBeNull();
    expect(out.toAccountId).toBeNull();
  });
  it("beneficiary writer/partner/shared menjadi Party dari sudut pandang pencatat", () => {
    expect(mapAiLine(aiLine({ beneficiary: "writer" }), ctx, NOW).recipient).toBe("me");
    expect(mapAiLine(aiLine({ beneficiary: "partner" }), ctx, NOW).recipient).toBe("partner");
  });
  it("jawaban per nomor baris; nomor di luar rentang dan duplikat diabaikan", () => {
    const out = mapAiOutput([aiLine({ line: 2, amount: 5 }), aiLine({ line: 2, amount: 9 }), aiLine({ line: 7 })], 2, ctx, NOW);
    expect(out[0]).toBeNull();
    expect(out[1]?.amount).toBe(5n);
  });
});

describe("gabung hasil AI dengan parser", () => {
  it("field yang sudah diisi parser tidak ditimpa, AI hanya mengisi yang kosong", () => {
    const [item] = run("servis motor 350rb gopay", [{ kind: "expense", amount: 999, accountName: "BCA Rizz", categoryName: "Transportasi", note: "Lain" }]);
    expect(item!.amount).toBe(350_000n);
    expect(item!.accountId).toBe("a-gopay-r");
    expect(item!.categoryId).toBe("c-transport");
    expect(item!.note).toBe("Servis motor");
    expect(item!.aiFields).toEqual(["category"]);
    expect(missingFields(item!, ctx)).toEqual([]);
  });
  it("akun default cakupan bukan isian parser, jadi akun yang disebut AI dipakai", () => {
    const [item] = run("iuran sampah seratus ribu", [{ kind: "expense", amount: "100rb", accountName: "Rekening Bersama", categoryName: "Rumah", beneficiary: "shared" }]);
    expect(item!.amount).toBe(100_000n);
    expect(item!.accountId).toBe("a-bersama");
    expect(item!.aiFields).toEqual(expect.arrayContaining(["amount", "account", "category", "kind"]));
  });
  it("nama di luar daftar tetap kosong dan ditandai", () => {
    const [item] = run("servis motor 350rb", [{ kind: "expense", categoryName: "Otomotif" }]);
    expect(item!.categoryId).toBeNull();
    expect(missingFields(item!, ctx)).toEqual(["category"]);
    expect(item!.aiFields).toEqual([]);
  });
  it("tebakan jenis parser tanpa kategori boleh dikoreksi AI", () => {
    const [item] = run("dapat uang arisan 500rb", [{ kind: "income", categoryName: "Lainnya" }]);
    expect(item!.kind).toBe("income");
    expect(item!.categoryId).toBe("c-lain-in");
  });
  it("tanggal yang disebut di teks tidak diganti; tanggal masa depan dari AI ditolak", () => {
    const [kemarin] = run("servis motor 350rb kemarin", [{ categoryName: "Transportasi", kind: "expense", date: "2026-09-20" }]);
    expect(kemarin!.occurredAt).toEqual(wib("2026-09-23T09:12:00"));
    const [future] = run("servis motor 350rb", [{ categoryName: "Transportasi", kind: "expense", date: "2026-09-30" }]);
    expect(future!.occurredAt).toEqual(NOW);
    expect(future!.aiFields).not.toContain("date");
  });
  it("hanya baris yang belum lengkap dikirim; baris lengkap tidak tersentuh", () => {
    const parserCtx = buildParserContext(ctx, "me", NOW);
    const drafts = parseQuickAdd("kopi 25rb gopay\nservis motor 350rb", parserCtx);
    expect(incompleteIndexes(drafts)).toEqual([1]);
    const items = run("kopi 25rb gopay\nservis motor 350rb", [{ kind: "expense", categoryName: "Transportasi" }]);
    expect(items[0]!.aiFields).toBeUndefined();
    expect(items[1]!.categoryId).toBe("c-transport");
  });
  it("mengubah field hasil AI menghapus tandanya", () => {
    const [item] = run("servis motor 350rb", [{ kind: "expense", categoryName: "Transportasi" }]);
    const edited = applyEdit(item!, { categoryId: "c-rumah" }, ctx);
    expect(edited.aiFields).toEqual([]);
  });
});

describe("skema dan prompt", () => {
  it("field yang hilang atau enum asing dianggap kosong", () => {
    const parsed = quickAddAiSchema.parse({ items: [{ line: 1, kind: "belanja", amount: "25rb" }] });
    const line = parsed.items[0]!;
    expect(line.kind).toBeNull();
    expect(line.accountName).toBeNull();
    expect(line.amount).toBe("25rb");
  });
  it("JSON schema ketat: semua field wajib, tanpa properti tambahan", () => {
    const props = quickAddAiJsonSchema.properties as { items: { items: { required: string[]; additionalProperties: boolean } } };
    const items = props.items;
    expect(items.items.required).toContain("categoryName");
    expect(items.items.additionalProperties).toBe(false);
  });
  it("prompt memuat daftar akun dengan pemilik, kategori, tanggal WIB, dan nama kedua orang", () => {
    const { system, user } = buildQuickAddPrompt({ ctx, today: "2026-09-24", weekday: 4, lines: ["servis motor 350rb"] });
    expect(system).toContain("schema: quick_add");
    expect(system).toContain("- GoPay Rizz (milik Rizz)");
    expect(system).toContain("- Rekening Bersama (Bersama)");
    expect(system).toContain("- Kopi dan jajan (bagian dari Makan dan minum)");
    expect(system).toContain("Kamis, 2026-09-24");
    expect(system).toContain("Pencatat: Rizz. Partner: Nadia.");
    expect(user).toBe("Baris input:\n1. servis motor 350rb");
  });
});
