export type BillFrequency = "monthly" | "weekly" | "yearly";

const FREQ: Record<string, BillFrequency> = { MONTHLY: "monthly", WEEKLY: "weekly", YEARLY: "yearly" };

export function frequencyOf(rrule: string): BillFrequency {
  const m = /FREQ=([A-Z]+)/i.exec(rrule);
  return FREQ[m?.[1]?.toUpperCase() ?? ""] ?? "monthly";
}

/** RRULE (RFC 5545) dari pilihan pengulangan; bulanan dikunci ke tanggal jatuh tempo. */
export function buildRrule(freq: BillFrequency, dueOn: string): string {
  if (freq === "weekly") return "FREQ=WEEKLY";
  if (freq === "yearly") return "FREQ=YEARLY";
  return `FREQ=MONTHLY;BYMONTHDAY=${Number(dueOn.slice(8, 10))}`;
}

const WEEKDAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export function recurrenceLabel(rrule: string, dueOn: string): string {
  const [y, mo, d] = dueOn.split("-").map(Number) as [number, number, number];
  const freq = frequencyOf(rrule);
  if (freq === "weekly") return `Mingguan, ${WEEKDAYS[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()]}`;
  if (freq === "yearly") return `Tahunan, ${d} ${MONTHS[mo - 1]}`;
  const byDay = /BYMONTHDAY=(\d+)/i.exec(rrule)?.[1];
  return `Bulanan, tanggal ${byDay ?? d}`;
}
