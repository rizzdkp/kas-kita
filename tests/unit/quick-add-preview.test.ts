import { describe, expect, it, vi } from "vitest";
import { parseQuickAdd } from "@/lib/quick-add-parser";
import {
  applyEdit,
  attachError,
  buildParserContext,
  defaultAccountFor,
  draftToItem,
  missingFields,
  missingReason,
  orderAccountsForScope,
  toBeneficiary,
  toCreateInput,
} from "@/components/quick-add/preview-model";
import type { PreviewItem, QuickAddContextData } from "@/components/quick-add/types";

vi.mock("@/server/db/client", () => ({ db: {} }));
const { accountAliases } = await import("@/server/queries/quick-add-context");

const wib = (iso: string) => new Date(`${iso}+07:00`);
// Kamis, 24 Sep 2026 09.12 WIB
const NOW = wib("2026-09-24T09:12:00");

const ctx: QuickAddContextData = {
  meName: "Rizz",
  partnerName: "Nadia",
  accounts: [
    { id: "a-jago-n", name: "Jago Nadia", type: "bank", owner: "partner", ownerName: "Nadia", aliases: ["bank jago", "jago"] },
    { id: "a-bersama", name: "Rekening Bersama", type: "bank", owner: "shared", ownerName: null, aliases: ["bca"] },
    { id: "a-bca-r", name: "BCA Rizz", type: "bank", owner: "me", ownerName: "Rizz", aliases: ["bca"] },
    { id: "a-ovo-n", name: "OVO Nadia", type: "ewallet", owner: "partner", ownerName: "Nadia", aliases: ["ovo"] },
    { id: "a-gopay-r", name: "GoPay Rizz", type: "ewallet", owner: "me", ownerName: "Rizz", aliases: ["gopay"] },
    { id: "a-tunai-r", name: "Tunai Rizz", type: "cash", owner: "me", ownerName: "Rizz", aliases: ["tunai"] },
    { id: "a-tunai-n", name: "Tunai Nadia", type: "cash", owner: "partner", ownerName: "Nadia", aliases: ["tunai"] },
  ],
  categories: [
    { id: "c-kopi", name: "Kopi dan jajan", kind: "expense", parentName: "Makan dan minum" },
    { id: "c-makan", name: "Makan di luar", kind: "expense", parentName: "Makan dan minum" },
    { id: "c-listrik", name: "Listrik", kind: "expense", parentName: "Rumah" },
    { id: "c-gaji", name: "Gaji", kind: "income", parentName: null },
  ],
  defaults: { me: "a-gopay-r", partner: "a-ovo-n", all: "a-gopay-r" },
};

function parseOne(input: string, scope: "me" | "partner" | "all" = "me"): PreviewItem {
  const [draft] = parseQuickAdd(input, buildParserContext(ctx, scope, NOW));
  return draftToItem(draft!, "11111111-1111-4111-8111-111111111111");
}

describe("alias akun otomatis", () => {
  it("BCA Rizz dengan institusi BCA dapat alias bca", () => {
    expect(accountAliases("BCA Rizz", "BCA", "bca", "bank")).toContain("bca");
  });
  it("nama institusi dua kata dipecah tanpa kata umum", () => {
    const aliases = accountAliases("Jago Nadia", "Bank Jago", "bank-jago", "bank");
    expect(aliases).toContain("jago");
    expect(aliases).not.toContain("bank");
  });
  it("kartu kredit dapat alias cc", () => {
    expect(accountAliases("Kartu Kredit BCA", "BCA", "bca", "credit_card")).toEqual(expect.arrayContaining(["bca", "cc"]));
  });
});

describe("cakupan menentukan urutan dan default akun", () => {
  it("akun partner didahulukan di cakupan Partner", () => {
    expect(orderAccountsForScope(ctx.accounts, "partner")[0]!.owner).toBe("partner");
    expect(orderAccountsForScope(ctx.accounts, "me")[0]!.owner).toBe("me");
  });
  it("default akun mengikuti cakupan (UX-FLOWS 4)", () => {
    expect(defaultAccountFor(ctx, "partner")).toBe("a-ovo-n");
    expect(defaultAccountFor(ctx, "me")).toBe("a-gopay-r");
    expect(defaultAccountFor({ ...ctx, defaults: { me: "a-bca-r", partner: null, all: null } }, "all")).toBe("a-bca-r");
  });
  it("kata ambigu jatuh ke akun di cakupan aktif", () => {
    expect(parseOne("bakso 20rb tunai", "me").accountId).toBe("a-tunai-r");
    expect(parseOne("bakso 20rb tunai", "partner").accountId).toBe("a-tunai-n");
  });
  it("bca di cakupan Saya cocok ke BCA Rizz, bukan rekening Bersama", () => {
    expect(parseOne("listrik 500rb bca").accountId).toBe("a-bca-r");
  });
  it("tanpa nama akun di cakupan Partner memakai akun partner", () => {
    const item = parseOne("makan 40rb", "partner");
    expect(item.accountId).toBe("a-ovo-n");
    expect(toCreateInput(item, ctx)?.beneficiary).toBe("owner");
  });
});

describe("draf menjadi kartu", () => {
  it("kopi 25rb gopay lengkap dan siap disimpan", () => {
    const item = parseOne("kopi 25rb gopay");
    expect(missingFields(item, ctx)).toEqual([]);
    expect(missingReason([])).toBeNull();
    expect(toCreateInput(item, ctx)).toEqual({
      clientId: "11111111-1111-4111-8111-111111111111",
      kind: "expense",
      amount: 25_000n,
      accountId: "a-gopay-r",
      toAccountId: null,
      categoryId: "c-kopi",
      occurredAt: NOW,
      note: "Kopi",
      beneficiary: "owner",
    });
  });

  it("field kosong ditandai dan tidak menghasilkan input mutasi (AC5)", () => {
    const item = parseOne("sesuatu gopay");
    expect(missingFields(item, ctx)).toEqual(["kind", "amount"]);
    expect(missingReason(missingFields(item, ctx))).toBe("Lengkapi jenis dan nominal untuk menyimpan.");
    expect(toCreateInput(item, ctx)).toBeNull();
  });

  it("kategori kosong ditandai", () => {
    const item = parseOne("xyz 10rb gopay");
    expect(missingFields(item, ctx)).toEqual(["category"]);
    expect(missingReason(["amount", "account", "category"])).toBe("Lengkapi nominal, akun dan kategori untuk menyimpan.");
  });

  it("untuk bersama menjadi beneficiary shared", () => {
    expect(toCreateInput(parseOne("listrik 500rb bca untuk bersama"), ctx)?.beneficiary).toBe("shared");
  });

  it("untuk saya di akun partner berarti yang login, jadi partner_of_owner", () => {
    const item = parseOne("makan 40rb untuk saya", "partner");
    expect(item.recipient).toBe("me");
    expect(toCreateInput(item, ctx)?.beneficiary).toBe("partner_of_owner");
  });

  it("untuk Nadia di akun sendiri menjadi partner_of_owner", () => {
    expect(toCreateInput(parseOne("makan 40rb gopay untuk nadia"), ctx)?.beneficiary).toBe("partner_of_owner");
  });
});

describe("edit kartu", () => {
  it("mengisi field kosong membuat kartu lengkap", () => {
    let item = parseOne("xyz 10rb gopay");
    item = applyEdit(item, { categoryId: "c-makan" }, ctx);
    expect(missingFields(item, ctx)).toEqual([]);
    expect(toCreateInput(item, ctx)?.categoryId).toBe("c-makan");
  });

  it("ganti jenis ke pemasukan membuang kategori pengeluaran", () => {
    const item = applyEdit(parseOne("kopi 25rb gopay"), { kind: "income" }, ctx);
    expect(item.categoryId).toBeNull();
    expect(missingFields(item, ctx)).toEqual(["category"]);
  });

  it("transfer butuh akun tujuan yang berbeda, tanpa kategori", () => {
    let item = applyEdit(parseOne("kopi 25rb gopay"), { kind: "transfer" }, ctx);
    expect(item.categoryId).toBeNull();
    expect(missingFields(item, ctx)).toEqual(["toAccount"]);
    item = applyEdit(item, { toAccountId: "a-gopay-r" }, ctx);
    expect(missingFields(item, ctx)).toEqual(["toAccount"]);
    item = applyEdit(item, { toAccountId: "a-bersama" }, ctx);
    expect(toCreateInput(item, ctx)).toMatchObject({ kind: "transfer", toAccountId: "a-bersama", categoryId: null, beneficiary: "owner" });
  });

  it("nominal nol dianggap kosong", () => {
    expect(missingFields(applyEdit(parseOne("kopi 25rb gopay"), { amount: 0n }, ctx), ctx)).toEqual(["amount"]);
  });

  it("akun Bersama selalu untuk Bersama", () => {
    expect(toCreateInput(applyEdit(parseOne("kopi 25rb gopay"), { accountId: "a-bersama" }, ctx), ctx)?.beneficiary).toBe("shared");
    expect(toBeneficiary("me", "partner")).toBe("partner_of_owner");
    expect(toBeneficiary("partner", "partner")).toBe("owner");
  });

  it("edit menghapus error lama", () => {
    const item = { ...parseOne("kopi 25rb gopay"), error: "Saldo kurang" };
    expect(applyEdit(item, { note: "Kopi susu" }, ctx).error).toBeNull();
  });
});

describe("error saldo menempel ke kartu yang tepat", () => {
  it("hanya kartu yang mengambil uang dari akun itu", () => {
    const a = { ...parseOne("bakso 20rb tunai"), clientId: "a" };
    const b = { ...parseOne("gaji 5jt tunai"), clientId: "b" };
    const c = { ...parseOne("kopi 25rb gopay"), clientId: "c" };
    const marked = attachError([a, b, c], "Saldo Tunai tinggal Rp 0", "a-tunai-r");
    expect(marked.map((i) => i.error)).toEqual(["Saldo Tunai tinggal Rp 0", null, null]);
  });
});
