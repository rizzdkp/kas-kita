import { addDaysKey, addMonthsKey } from "./_time";

/** Subset RRULE (RFC 5545) yang dipakai tagihan dan jadwal: FREQ, INTERVAL, BYMONTHDAY. */
export interface SimpleRrule {
  freq: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval: number;
  byMonthDay: number | null;
}

export function parseRrule(rule: string): SimpleRrule {
  const parts = new Map(
    rule
      .replace(/^RRULE:/i, "")
      .split(";")
      .map((p) => p.split("=") as [string, string])
      .map(([k, v]) => [k.toUpperCase(), (v ?? "").toUpperCase()]),
  );
  const freq = parts.get("FREQ");
  if (freq !== "DAILY" && freq !== "WEEKLY" && freq !== "MONTHLY" && freq !== "YEARLY") {
    throw new RangeError(`RRULE tidak didukung: ${rule}`);
  }
  const interval = Math.max(1, Number(parts.get("INTERVAL") ?? "1") || 1);
  const bmd = parts.get("BYMONTHDAY");
  return { freq, interval, byMonthDay: bmd ? Number(bmd) : null };
}

export function isValidRrule(rule: string): boolean {
  try {
    parseRrule(rule);
    return true;
  } catch {
    return false;
  }
}

/** Kejadian berikutnya setelah `from` (kunci hari). Tanggal yang tidak ada jatuh ke hari terakhir bulan. */
export function nextOccurrence(rule: string, from: string): string {
  const r = parseRrule(rule);
  switch (r.freq) {
    case "DAILY":
      return addDaysKey(from, r.interval);
    case "WEEKLY":
      return addDaysKey(from, 7 * r.interval);
    case "MONTHLY":
      return addMonthsKey(from, r.interval, r.byMonthDay ?? undefined);
    case "YEARLY":
      return addMonthsKey(from, 12 * r.interval);
  }
}

/** Semua kejadian mulai `first` sampai sebelum `until` (eksklusif), dibatasi supaya aman. */
export function occurrencesBefore(rule: string, first: string, until: string, max = 60): string[] {
  const out: string[] = [];
  for (let k = first; k < until && out.length < max; k = nextOccurrence(rule, k)) out.push(k);
  return out;
}
