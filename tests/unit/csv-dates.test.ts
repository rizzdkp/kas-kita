import { describe, expect, it } from "vitest";
import { datesInText, detectDateFormat, parseCsvDate, parseCsvTime } from "@/server/import/csv/dates";

const REF = "2026-09-20";
const d = (date: string, time: string | null = null) => ({ date, time });

describe("parseCsvDate", () => {
  it("DD/MM/YYYY termasuk tahun dua digit dan jam", () => {
    expect(parseCsvDate("01/09/2026", "DD/MM/YYYY", REF)).toEqual(d("2026-09-01"));
    expect(parseCsvDate("1/9/26", "DD/MM/YYYY", REF)).toEqual(d("2026-09-01"));
    expect(parseCsvDate("01/09/2026 14:05", "DD/MM/YYYY", REF)).toEqual(d("2026-09-01", "14:05"));
    expect(parseCsvDate("31/02/2026", "DD/MM/YYYY", REF)).toBeNull();
    expect(parseCsvDate("2026-09-01", "DD/MM/YYYY", REF)).toBeNull();
  });

  it("DD/MM tanpa tahun (gaya BCA) memakai tahun tanggal acuan, mundur setahun bila melewati acuan", () => {
    expect(parseCsvDate("'01/09", "DD/MM/YYYY", REF)).toEqual(d("2026-09-01"));
    expect(parseCsvDate("28/12", "DD/MM/YYYY", "2027-01-05")).toEqual(d("2026-12-28"));
    expect(parseCsvDate("PEND", "DD/MM/YYYY", REF)).toBeNull();
  });

  it("YYYY-MM-DD dengan jam ISO", () => {
    expect(parseCsvDate("2026-09-01", "YYYY-MM-DD", REF)).toEqual(d("2026-09-01"));
    expect(parseCsvDate("2026-09-01T08:15:30", "YYYY-MM-DD", REF)).toEqual(d("2026-09-01", "08:15"));
    expect(parseCsvDate("2026-13-01", "YYYY-MM-DD", REF)).toBeNull();
  });

  it("DD MMM YYYY dengan bulan Indonesia dan Inggris", () => {
    expect(parseCsvDate("05 Agu 2026", "DD MMM YYYY", REF)).toEqual(d("2026-08-05"));
    expect(parseCsvDate("07 Agt 2026", "DD MMM YYYY", REF)).toEqual(d("2026-08-07"));
    expect(parseCsvDate("10 Oktober 2026", "DD MMM YYYY", REF)).toEqual(d("2026-10-10"));
    expect(parseCsvDate("3 Mei 2026", "DD MMM YYYY", REF)).toEqual(d("2026-05-03"));
    expect(parseCsvDate("03 May 2026", "DD MMM YYYY", REF)).toEqual(d("2026-05-03"));
    expect(parseCsvDate("12-Dec-25", "DD MMM YYYY", REF)).toEqual(d("2025-12-12"));
    expect(parseCsvDate("12 Des 2025", "DD MMM YYYY", REF)).toEqual(d("2025-12-12"));
    expect(parseCsvDate("12 Foo 2025", "DD MMM YYYY", REF)).toBeNull();
  });

  it("DD-MM-YYYY dan MM/DD/YYYY", () => {
    expect(parseCsvDate("15-08-2026", "DD-MM-YYYY", REF)).toEqual(d("2026-08-15"));
    expect(parseCsvDate("32-08-2026", "DD-MM-YYYY", REF)).toBeNull();
    expect(parseCsvDate("08/15/2026", "MM/DD/YYYY", REF)).toEqual(d("2026-08-15"));
  });
});

describe("detectDateFormat", () => {
  it("mengenali tiap format", () => {
    expect(detectDateFormat(["01/09/2026", "15/09/2026"], REF)).toBe("DD/MM/YYYY");
    expect(detectDateFormat(["2026-09-01", "2026-09-15"], REF)).toBe("YYYY-MM-DD");
    expect(detectDateFormat(["02 Sep 2026", "05 Agu 2026"], REF)).toBe("DD MMM YYYY");
    expect(detectDateFormat(["01-08-2026", "15-08-2026"], REF)).toBe("DD-MM-YYYY");
  });

  it("DD/MM menang saat ambigu, MM/DD hanya bila hari > 12 di posisi kedua", () => {
    expect(detectDateFormat(["01/09/2026", "02/09/2026"], REF)).toBe("DD/MM/YYYY");
    expect(detectDateFormat(["08/15/2026", "08/20/2026"], REF)).toBe("MM/DD/YYYY");
  });

  it("null untuk kolom yang bukan tanggal", () => {
    expect(detectDateFormat(["Kopi", "Parkir"], REF)).toBeNull();
    expect(detectDateFormat([], REF)).toBeNull();
  });
});

describe("parseCsvTime dan datesInText", () => {
  it("jam", () => {
    expect(parseCsvTime("8:15")).toBe("08:15");
    expect(parseCsvTime("21.10")).toBe("21:10");
    expect(parseCsvTime("25:00")).toBeNull();
  });

  it("tanggal di baris judul", () => {
    expect(datesInText("Periode : 01/09/2026 - 20/09/2026")).toEqual(["2026-09-01", "2026-09-20"]);
    expect(datesInText("Periode 01-08-2026 s/d 31-08-2026")).toEqual(["2026-08-01", "2026-08-31"]);
    expect(datesInText("Dicetak 5 Sep 2026")).toEqual(["2026-09-05"]);
  });
});
