import { describe, expect, it } from "vitest";
import {
  buildRecurrenceRule,
  describeRecurrence,
  dueRuns,
  firstRunAfter,
  isValidRecurrence,
  MAX_CATCH_UP,
  nextRunAfter,
  parseRecurrence,
  shortMonthNote,
} from "@/server/recurring/schedule";
import { parseTemplate } from "@/server/recurring/template";

describe("buildRecurrenceRule", () => {
  it("mengunci jangkar hari, hari dalam minggu, dan bulan", () => {
    expect(buildRecurrenceRule("daily", "2026-10-03")).toBe("FREQ=DAILY");
    // 3 Okt 2026 hari Sabtu
    expect(buildRecurrenceRule("weekly", "2026-10-03")).toBe("FREQ=WEEKLY;BYDAY=SA");
    expect(buildRecurrenceRule("monthly", "2026-01-31")).toBe("FREQ=MONTHLY;BYMONTHDAY=31");
    expect(buildRecurrenceRule("yearly", "2028-02-29")).toBe("FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=29");
    expect(buildRecurrenceRule("weekly", "2026-10-05", 2)).toBe("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO");
  });

  it("menolak RRULE yang tidak didukung", () => {
    expect(isValidRecurrence("FREQ=HOURLY")).toBe(false);
    expect(isValidRecurrence("FREQ=MONTHLY;BYMONTHDAY=32")).toBe(false);
    expect(isValidRecurrence("FREQ=WEEKLY;BYDAY=XX")).toBe(false);
    expect(parseRecurrence("RRULE:FREQ=MONTHLY;INTERVAL=3")).toEqual({ frequency: "monthly", interval: 3, byDay: null, byMonthDay: null, byMonth: null });
  });
});

describe("nextRunAfter", () => {
  it("bulanan tanggal 31 jatuh ke hari terakhir Februari lalu kembali ke 31", () => {
    const rule = buildRecurrenceRule("monthly", "2026-01-31");
    expect(nextRunAfter(rule, "2026-01-31")).toBe("2026-02-28");
    expect(nextRunAfter(rule, "2026-02-28")).toBe("2026-03-31");
    expect(nextRunAfter(rule, "2026-03-31")).toBe("2026-04-30");
    // tahun kabisat
    expect(nextRunAfter(rule, "2028-01-31")).toBe("2028-02-29");
  });

  it("bulanan melewati pergantian tahun", () => {
    expect(nextRunAfter(buildRecurrenceRule("monthly", "2026-12-15"), "2026-12-15")).toBe("2027-01-15");
  });

  it("mingguan maju tujuh hari di hari yang sama", () => {
    const rule = buildRecurrenceRule("weekly", "2026-10-05");
    expect(nextRunAfter(rule, "2026-10-05")).toBe("2026-10-12");
    expect(nextRunAfter(rule, "2026-12-28")).toBe("2027-01-04");
    // tanggal yang bukan Senin diluruskan ke Senin berikutnya
    expect(nextRunAfter(rule, "2026-10-07")).toBe("2026-10-12");
    expect(nextRunAfter(buildRecurrenceRule("weekly", "2026-10-05", 2), "2026-10-05")).toBe("2026-10-19");
  });

  it("tahunan 29 Feb jatuh ke 28 Feb di tahun biasa dan kembali ke 29 di tahun kabisat", () => {
    const rule = buildRecurrenceRule("yearly", "2028-02-29");
    expect(nextRunAfter(rule, "2028-02-29")).toBe("2029-02-28");
    expect(nextRunAfter(rule, "2029-02-28")).toBe("2030-02-28");
    expect(nextRunAfter(rule, "2031-02-28")).toBe("2032-02-29");
  });

  it("harian", () => {
    expect(nextRunAfter("FREQ=DAILY", "2026-12-31")).toBe("2027-01-01");
  });
});

describe("dueRuns", () => {
  it("belum jatuh tempo: tidak ada yang dibuat", () => {
    expect(dueRuns("FREQ=MONTHLY;BYMONTHDAY=5", "2026-10-05", "2026-10-03")).toEqual({ dates: [], next: "2026-10-05", skipped: 0 });
  });

  it("tepat hari ini: satu periode, berikutnya bulan depan", () => {
    expect(dueRuns("FREQ=MONTHLY;BYMONTHDAY=3", "2026-10-03", "2026-10-03")).toEqual({ dates: ["2026-10-03"], next: "2026-11-03", skipped: 0 });
  });

  it("tertinggal beberapa periode: semua periode terlewat dibuat", () => {
    const run = dueRuns("FREQ=MONTHLY;BYMONTHDAY=31", "2026-07-31", "2026-10-03");
    expect(run.dates).toEqual(["2026-07-31", "2026-08-31", "2026-09-30"]);
    expect(run.next).toBe("2026-10-31");
  });

  it(`tertinggal lebih dari ${MAX_CATCH_UP} periode: hanya ${MAX_CATCH_UP} terakhir`, () => {
    const run = dueRuns("FREQ=DAILY", "2026-08-01", "2026-10-03");
    // 1 Agu sampai 3 Okt = 31 + 30 + 3 = 64 hari
    expect(run.dates).toHaveLength(MAX_CATCH_UP);
    expect(run.skipped).toBe(64 - MAX_CATCH_UP);
    expect(run.dates.at(-1)).toBe("2026-10-03");
    expect(run.dates[0]).toBe("2026-09-03");
    expect(run.next).toBe("2026-10-04");
  });
});

describe("firstRunAfter", () => {
  it("dari transaksi lama, kejadian pertama yang tidak sebelum hari ini", () => {
    expect(firstRunAfter("FREQ=MONTHLY;BYMONTHDAY=25", "2026-06-25", "2026-10-03")).toBe("2026-10-25");
    expect(firstRunAfter("FREQ=MONTHLY;BYMONTHDAY=3", "2026-10-03", "2026-10-03")).toBe("2026-11-03");
  });
});

describe("describeRecurrence", () => {
  it("label sesuai COPY.md", () => {
    expect(describeRecurrence("FREQ=DAILY", "2026-10-03")).toBe("Harian");
    expect(describeRecurrence("FREQ=WEEKLY;BYDAY=MO", "2026-10-05")).toBe("Mingguan, Senin");
    expect(describeRecurrence("FREQ=MONTHLY;BYMONTHDAY=31", "2026-02-28")).toBe("Bulanan, tanggal 31");
    expect(describeRecurrence("FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=29", "2029-02-28")).toBe("Tahunan, 29 Feb");
    expect(describeRecurrence("FREQ=WEEKLY;INTERVAL=2;BYDAY=FR", "2026-10-09")).toBe("Setiap 2 minggu, Jumat");
    expect(shortMonthNote("FREQ=MONTHLY;BYMONTHDAY=30")).toMatch(/hari terakhirnya/);
    expect(shortMonthNote("FREQ=MONTHLY;BYMONTHDAY=28")).toBeNull();
  });
});

describe("parseTemplate", () => {
  const base = { kind: "expense", amount: "350000", accountId: "0192f0a0-0000-7000-8000-000000000001", categoryId: "0192f0a0-0000-7000-8000-000000000002" };
  it("menerima nominal string bigint dan mengisi default", () => {
    expect(parseTemplate(base)).toMatchObject({ amount: "350000", toAccountId: null, note: null, beneficiary: "owner", tagNames: [] });
    expect(parseTemplate({ ...base, amount: "9223372036854775807" })?.amount).toBe("9223372036854775807");
  });
  it("menolak nominal number, nol, dan bentuk transfer yang salah", () => {
    expect(parseTemplate({ ...base, amount: 350000 })).toBeNull();
    expect(parseTemplate({ ...base, amount: "0" })).toBeNull();
    expect(parseTemplate({ ...base, kind: "transfer" })).toBeNull();
  });
});
