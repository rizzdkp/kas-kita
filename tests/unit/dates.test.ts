import { afterAll, describe, expect, it } from "vitest";
import {
  comparablePreviousRange, dateKey, daysUntil, formatCountdown, formatDateWithYear, formatRangeLabel,
  formatRelativeDay, formatShortDate, formatTime, jakartaDate, nextPayday, nowJakarta, parseDateKey,
  periodRange, startOfDayJakarta, todayJakarta,
} from "@/lib/dates";

const originalTz = process.env.TZ;
afterAll(() => {
  process.env.TZ = originalTz;
});

// helper: instan dari waktu WIB eksplisit
const wib = (iso: string) => new Date(`${iso}+07:00`);
const iso = (d: Date) => new Date(d.getTime()).toISOString();

// hasil harus sama walau TZ proses bukan WIB
describe.each(["Asia/Jakarta", "UTC", "America/Los_Angeles", "Pacific/Kiritimati"])("TZ proses %s", (tz) => {
  process.env.TZ = tz;
  const setTz = () => {
    process.env.TZ = tz;
  };

  it("23.30 WIB tetap hari yang sama walau tanggal UTC berbeda", () => {
    setTz();
    // pastikan TZ proses benar-benar berganti
    if (tz === "UTC") expect(new Date(0).getTimezoneOffset()).toBe(0);
    if (tz === "America/Los_Angeles") expect(new Date(0).getTimezoneOffset()).toBe(480);
    const late = wib("2026-09-12T23:30:00");
    expect(late.toISOString()).toBe("2026-09-12T16:30:00.000Z");
    expect(todayJakarta(late)).toBe("2026-09-12");
    expect(formatShortDate(late)).toBe("12 Sep");
    expect(formatTime(late)).toBe("23.30");
    // 00.30 WIB sudah hari berikutnya, padahal UTC masih tanggal 12
    const early = wib("2026-09-13T00:30:00");
    expect(early.getUTCDate()).toBe(12);
    expect(todayJakarta(early)).toBe("2026-09-13");
    expect(iso(startOfDayJakarta(early))).toBe("2026-09-12T17:00:00.000Z");
  });

  it("gajian tanggal 31 di Februari jatuh ke hari terakhir", () => {
    setTz();
    expect(dateKey(nextPayday(31, wib("2026-02-10T08:00:00")))).toBe("2026-02-28");
    expect(dateKey(nextPayday(31, wib("2028-02-10T08:00:00")))).toBe("2028-02-29");
    expect(dateKey(nextPayday(31, wib("2026-03-01T08:00:00")))).toBe("2026-03-31");
    expect(dateKey(nextPayday(31, wib("2026-04-30T23:59:00")))).toBe("2026-04-30");
  });

  it("periode siklus gajian", () => {
    setTz();
    // gajian 25, hari ini 24 Sep: siklus 25 Agu sampai 24 Sep
    const r = periodRange("payday_cycle", 25, wib("2026-09-24T10:00:00"));
    expect(iso(r.start)).toBe(iso(wib("2026-08-25T00:00:00")));
    expect(iso(r.end)).toBe(iso(wib("2026-09-25T00:00:00")));
    expect(formatRangeLabel(r)).toBe("25 Agu-24 Sep");
    // tepat hari gajian memulai siklus baru
    const r2 = periodRange("payday_cycle", 25, wib("2026-09-25T00:00:00"));
    expect(dateKey(r2.start)).toBe("2026-09-25");
    expect(dateKey(r2.end)).toBe("2026-10-25");
  });
});

describe("tanggal dan format", () => {
  it("nowJakarta memakai instan yang disuntikkan", () => {
    const now = wib("2026-09-24T09:12:00");
    expect(nowJakarta(now).getTime()).toBe(now.getTime());
    expect(nowJakarta(now).getHours()).toBe(9);
  });

  it("format tanggal dan waktu", () => {
    const d = wib("2026-09-12T09:12:00");
    expect(formatShortDate(d)).toBe("12 Sep");
    expect(formatDateWithYear(d)).toBe("12 Sep 2026");
    expect(formatTime(d)).toBe("09.12");
    expect(formatShortDate(wib("2026-08-01T00:00:00"))).toBe("1 Agu");
    expect(formatShortDate(wib("2026-05-03T00:00:00"))).toBe("3 Mei");
    expect(formatShortDate(wib("2026-12-31T00:00:00"))).toBe("31 Des");
    expect(formatShortDate(wib("2026-10-31T00:00:00"))).toBe("31 Okt");
  });

  it("dateKey dan parseDateKey", () => {
    expect(iso(parseDateKey("2026-09-12")!)).toBe("2026-09-11T17:00:00.000Z");
    expect(parseDateKey("2026-02-30")).toBeNull();
    expect(parseDateKey("12-09-2026")).toBeNull();
  });

  it("formatRelativeDay", () => {
    const now = wib("2026-09-12T08:00:00");
    expect(formatRelativeDay(wib("2026-09-12T23:59:00"), now)).toBe("Hari ini");
    expect(formatRelativeDay(wib("2026-09-11T00:01:00"), now)).toBe("Kemarin");
    expect(formatRelativeDay(wib("2026-09-10T12:00:00"), now)).toBe("10 Sep");
    expect(formatRelativeDay(wib("2025-12-30T12:00:00"), now)).toBe("30 Des 2025");
  });

  it("formatCountdown", () => {
    expect(formatCountdown(0)).toBe("hari ini");
    expect(formatCountdown(1)).toBe("besok");
    expect(formatCountdown(3)).toBe("3 hari lagi");
    expect(formatCountdown(-1)).toBe("telat 1 hari");
    expect(formatCountdown(-2)).toBe("telat 2 hari");
  });

  it("daysUntil memakai hari kalender WIB, bukan selisih jam", () => {
    expect(daysUntil(wib("2026-09-13T00:10:00"), wib("2026-09-12T23:50:00"))).toBe(1);
    expect(daysUntil(wib("2026-09-12T00:00:00"), wib("2026-09-12T23:59:00"))).toBe(0);
    expect(daysUntil(wib("2026-09-10T12:00:00"), wib("2026-09-12T08:00:00"))).toBe(-2);
    expect(daysUntil(wib("2027-01-01T00:00:00"), wib("2026-12-31T23:00:00"))).toBe(1);
  });
});

describe("nextPayday", () => {
  it("hari gajian sendiri dihitung hari ini", () => {
    const now = wib("2026-09-25T10:00:00");
    const p = nextPayday(25, now);
    expect(dateKey(p)).toBe("2026-09-25");
    expect(daysUntil(p, now)).toBe(0);
  });

  it("sesudah gajian loncat ke bulan berikutnya, termasuk lintas tahun", () => {
    expect(dateKey(nextPayday(25, wib("2026-09-26T10:00:00")))).toBe("2026-10-25");
    expect(dateKey(nextPayday(25, wib("2026-12-26T10:00:00")))).toBe("2027-01-25");
    expect(dateKey(nextPayday(30, wib("2026-01-31T10:00:00")))).toBe("2026-02-28");
  });

  it("hari menuju gajian", () => {
    const now = wib("2026-09-24T09:00:00");
    expect(daysUntil(nextPayday(25, now), now)).toBe(1);
    expect(daysUntil(nextPayday(1, now), now)).toBe(7);
  });
});

describe("periodRange", () => {
  it("bulan kalender, end eksklusif", () => {
    const r = periodRange("calendar", 25, wib("2026-09-10T15:00:00"));
    expect(iso(r.start)).toBe("2026-08-31T17:00:00.000Z");
    expect(iso(r.end)).toBe("2026-09-30T17:00:00.000Z");
    expect(formatRangeLabel(r)).toBe("1-30 Sep");
    const dec = periodRange("calendar", 1, wib("2026-12-31T23:59:00"));
    expect(dateKey(dec.end)).toBe("2027-01-01");
  });

  it("siklus gajian dengan tanggal 31 melewati Februari", () => {
    // gajian 31: 31 Jan - 27 Feb, lalu 28 Feb - 30 Mar
    const jan = periodRange("payday_cycle", 31, wib("2026-02-27T12:00:00"));
    expect(dateKey(jan.start)).toBe("2026-01-31");
    expect(dateKey(jan.end)).toBe("2026-02-28");
    const feb = periodRange("payday_cycle", 31, wib("2026-02-28T00:00:00"));
    expect(dateKey(feb.start)).toBe("2026-02-28");
    expect(dateKey(feb.end)).toBe("2026-03-31");
    expect(formatRangeLabel(feb)).toBe("28 Feb-30 Mar");
  });

  it("siklus gajian lintas tahun", () => {
    const r = periodRange("payday_cycle", 25, wib("2026-01-05T12:00:00"));
    expect(dateKey(r.start)).toBe("2025-12-25");
    expect(dateKey(r.end)).toBe("2026-01-25");
    expect(formatRangeLabel(r)).toBe("25 Des 2025-24 Jan 2026");
  });

  it("paydayDay di luar 1-31 dinormalkan", () => {
    expect(periodRange("payday_cycle", 40, wib("2026-09-10T00:00:00")).paydayDay).toBe(31);
    expect(periodRange("payday_cycle", 0, wib("2026-09-10T00:00:00")).paydayDay).toBe(1);
  });
});

describe("comparablePreviousRange", () => {
  it("10 Sep dibanding 1-10 Agu, bukan seluruh Agustus", () => {
    const today = wib("2026-09-10T20:00:00");
    const { current, previous } = comparablePreviousRange(periodRange("calendar", 25, today), today);
    expect(formatRangeLabel(current)).toBe("1-10 Sep");
    expect(formatRangeLabel(previous)).toBe("1-10 Agu");
    expect(iso(previous.start)).toBe("2026-07-31T17:00:00.000Z");
    expect(iso(previous.end)).toBe("2026-08-10T17:00:00.000Z");
  });

  it("31 Mar dibanding seluruh Februari, tidak melewati awal Maret", () => {
    const today = wib("2026-03-31T08:00:00");
    const { current, previous } = comparablePreviousRange(periodRange("calendar", 1, today), today);
    expect(formatRangeLabel(current)).toBe("1-31 Mar");
    expect(formatRangeLabel(previous)).toBe("1-28 Feb");
  });

  it("hari pertama periode dibanding hari pertama periode lalu", () => {
    const today = wib("2026-01-01T00:00:00");
    const { previous } = comparablePreviousRange(periodRange("calendar", 1, today), today);
    expect(formatRangeLabel(previous)).toBe("1 Des");
  });

  it("siklus gajian: 3 hari setelah gajian dibanding 3 hari pertama siklus lalu", () => {
    const today = wib("2026-09-27T12:00:00");
    const { current, previous } = comparablePreviousRange(periodRange("payday_cycle", 25, today), today);
    expect(formatRangeLabel(current)).toBe("25-27 Sep");
    expect(formatRangeLabel(previous)).toBe("25-27 Agu");
  });

  it("siklus gajian 31 memakai awal siklus lalu yang benar", () => {
    const today = wib("2026-03-02T12:00:00");
    const { current, previous } = comparablePreviousRange(periodRange("payday_cycle", 31, today), today);
    expect(formatRangeLabel(current)).toBe("28 Feb-2 Mar");
    expect(formatRangeLabel(previous)).toBe("31 Jan-2 Feb");
  });

  it("periode yang sudah lewat dibandingkan penuh", () => {
    const aug = periodRange("calendar", 1, wib("2026-08-15T00:00:00"));
    const { current, previous } = comparablePreviousRange(aug, wib("2026-09-24T00:00:00"));
    expect(formatRangeLabel(current)).toBe("1-31 Agu");
    expect(formatRangeLabel(previous)).toBe("1-31 Jul");
  });

  it("jakartaDate menerima bulan yang meluap", () => {
    expect(iso(jakartaDate(2026, 12, 1))).toBe("2026-12-31T17:00:00.000Z");
  });
});
