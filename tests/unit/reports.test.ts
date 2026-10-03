import { describe, expect, it } from "vitest";
import { csvCell, csvFilename, csvLine } from "@/app/api/export/_lib/csv";
import { transactionFiltersFromLink } from "@/app/api/export/_lib/filters";
import { heroLabel } from "@/components/dashboard/hero-label";
import { buildInsights, type WeeklyFacts } from "@/components/dashboard/insight-templates";
import { formatMonthAxis, formatMonthLong, parseMonthParam, reportRanges, shiftMonth } from "@/components/reports/months";
import { parseTransactionSearchParams, transactionHref } from "@/components/reports/transaction-link";
import { trendTitle } from "@/components/reports/trend-title";

const CAT = "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b";
const ACC = "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5c";

describe("kontrak query string Transaksi", () => {
  it("membangun href dengan nama param Indonesia", () => {
    expect(transactionHref({ scope: "all", categoryIds: [CAT], kinds: ["expense"], from: "2026-08-01", to: "2026-08-31" })).toBe(
      `/transaksi?kategori=${CAT}&jenis=expense&dari=2026-08-01&sampai=2026-08-31&scope=all`,
    );
    expect(transactionHref({ scope: "me" })).toBe("/transaksi");
    expect(transactionHref({ status: "draft" })).toBe("/transaksi?status=draft");
  });

  it("parse kebalikan dari build, termasuk nilai jamak dan param berulang", () => {
    const f = { scope: "partner" as const, accountIds: [ACC], categoryIds: [CAT], kinds: ["income" as const, "transfer" as const], from: "2026-09-01", to: "2026-09-24", q: "kopi" };
    expect(parseTransactionSearchParams(new URLSearchParams(transactionHref(f).split("?")[1]))).toEqual(f);
    expect(parseTransactionSearchParams({ kategori: [CAT, CAT] }).categoryIds).toEqual([CAT]);
  });

  it("membuang nilai yang tidak valid", () => {
    const f = parseTransactionSearchParams({ kategori: "bukan-uuid", jenis: "hutang", dari: "2026-13", scope: "x" });
    expect(f).toEqual({ scope: "me" });
  });

  it("tanpa partner cakupan export selalu Saya", () => {
    expect(transactionFiltersFromLink({ scope: "all" }, false).scope).toBe("me");
    expect(transactionFiltersFromLink({ scope: "all" }, true).scope).toBe("all");
  });
});

describe("periode laporan", () => {
  it("?bulan= kosong, rusak, atau bulan depan jatuh ke bulan berjalan", () => {
    expect(parseMonthParam(undefined, "2026-09-24")).toBe("2026-09");
    expect(parseMonthParam("2026-13", "2026-09-24")).toBe("2026-09");
    expect(parseMonthParam("2026-10", "2026-09-24")).toBe("2026-09");
    expect(parseMonthParam("2025-12", "2026-09-24")).toBe("2025-12");
  });

  it("geser bulan melewati pergantian tahun", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2025-12", 1)).toBe("2026-01");
    expect(shiftMonth("2026-09", -11)).toBe("2025-10");
  });

  it("bulan lampau: bulan penuh vs bulan penuh sebelumnya", () => {
    const r = reportRanges("2026-08", "2026-09-24");
    expect(r.isCurrentMonth).toBe(false);
    expect([r.current.from, r.current.to, r.current.label]).toEqual(["2026-08-01", "2026-08-31", "1-31 Agu"]);
    expect([r.previous.from, r.previous.to, r.previous.label]).toEqual(["2026-07-01", "2026-07-31", "1-31 Jul"]);
    // akhir eksklusif = awal 1 Sep WIB = 31 Agu 17.00 UTC
    expect(r.current.end.toISOString()).toBe("2026-08-31T17:00:00.000Z");
  });

  it("bulan berjalan: 1-hari ini vs tanggal sama bulan lalu (PRD bagian 6)", () => {
    const r = reportRanges("2026-09", "2026-09-10");
    expect(r.current.label).toBe("1-10 Sep");
    expect(r.previous.label).toBe("1-10 Agu");
  });

  it("tanggal 31 dibandingkan dengan akhir bulan yang lebih pendek", () => {
    const r = reportRanges("2026-03", "2026-03-31");
    expect([r.previous.from, r.previous.to]).toEqual(["2026-02-01", "2026-02-28"]);
  });

  it("label bulan", () => {
    expect(formatMonthLong("2026-09")).toBe("September 2026");
    expect(formatMonthAxis("2026-05")).toBe("Mei");
    expect(formatMonthAxis("2026-01")).toBe("Jan 26");
  });
});

describe("CSV", () => {
  it("nominal angka bulat apa adanya", () => {
    expect(csvCell(25_000n)).toBe("25000");
    expect(csvCell(null)).toBe("");
  });

  it("escape koma, kutip, dan baris baru", () => {
    expect(csvCell('Kopi "susu", gula')).toBe('"Kopi ""susu"", gula"');
    expect(csvCell("a\nb")).toBe('"a\nb"');
  });

  it("teks yang bisa jadi rumus spreadsheet diberi awalan kutip", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("-5")).toBe("'-5");
    expect(csvCell("@sum")).toBe("'@sum");
  });

  it("baris diakhiri CRLF dan nama file memuat rentang", () => {
    expect(csvLine(["2026-08-01", 1n, "x"])).toBe("2026-08-01,1,x\r\n");
    expect(csvFilename("2026-08-01", "2026-08-31")).toBe("kas-kita-transaksi-2026-08-01-sampai-2026-08-31.csv");
    expect(csvFilename()).toBe("kas-kita-transaksi.csv");
  });
});

describe("label hero per cakupan (COPY.md)", () => {
  it("Saya, Partner, Gabungan", () => {
    expect(heroLabel("me", "Nadia", 12)).toBe("Aman dibelanjakan sampai gajian, 12 hari lagi");
    expect(heroLabel("partner", "Nadia", 1)).toBe("Nadia: aman dibelanjakan sampai gajian, besok");
    expect(heroLabel("all", "Nadia", 0)).toBe("Kalian berdua: aman dibelanjakan sampai gajian terdekat, hari ini");
    expect(heroLabel("all", null, 3)).toBe("Aman dibelanjakan sampai gajian, 3 hari lagi");
  });
});

describe("wawasan dari templat tetap (F-AI-2 AC4)", () => {
  const base: WeeklyFacts = { scope: "me", today: "2026-09-24", topIncrease: null, weekTotal: 0n, weekCount: 0, fastBudget: null, dueBill: null };

  it("setiap angka berasal dari fakta dan setiap wawasan menautkan transaksinya", () => {
    const out = buildInsights({
      ...base,
      topIncrease: { categoryId: CAT, name: "Makan dan minum", current: 358_500n, previous: 348_000n },
      fastBudget: { categoryId: CAT, name: "Keluarga", usedPercent: 100, elapsedPercent: 80, over: false },
      weekTotal: 1_108_000n,
      weekCount: 13,
    });
    expect(out.map((i) => i.text)).toEqual([
      "Pengeluaran Makan dan minum 7 hari terakhir Rp 358.500, naik Rp 10.500 dari 7 hari sebelumnya.",
      "Anggaran Keluarga sudah terpakai 100%, padahal bulan baru berjalan 80%.",
      "Total pengeluaran 7 hari terakhir Rp 1.108.000 dari 13 transaksi.",
    ]);
    expect(out[0]!.href).toBe(`/transaksi?kategori=${CAT}&dari=2026-09-18&sampai=2026-09-24`);
    expect(out[1]!.href).toBe(`/transaksi?kategori=${CAT}&dari=2026-09-01&sampai=2026-09-24`);
    expect(out[2]!.href).toBe("/transaksi?jenis=expense&dari=2026-09-18&sampai=2026-09-24");
  });

  it("maksimal tiga, tagihan hanya mengisi sisa slot", () => {
    const out = buildInsights({ ...base, weekTotal: 10n, weekCount: 1, dueBill: { name: "BPJS", amount: 150_000n, daysUntilDue: 2, categoryId: null } });
    expect(out).toHaveLength(2);
    expect(out[1]!.text).toBe("Tagihan BPJS Rp 150.000 jatuh tempo 2 hari lagi.");
  });

  it("tanpa fakta tidak ada kalimat", () => {
    expect(buildInsights(base)).toEqual([]);
  });
});

describe("judul grafik tren", () => {
  it("menjawab berapa bulan defisit", () => {
    expect(trendTitle([])).toBe("Belum ada transaksi 12 bulan terakhir");
    expect(
      trendTitle([
        { month: "2026-07", income: 10n, expense: 20n },
        { month: "2026-08", income: 30n, expense: 20n },
        { month: "2026-09", income: 0n, expense: 0n },
      ]),
    ).toBe("Pengeluaran melebihi pemasukan di 1 dari 2 bulan tercatat");
  });
});
