import type { DashboardPeriod } from "@/server/queries/dashboard";

/** ?periode=lalu memilih periode sebelumnya; nilai lain jatuh ke periode berjalan. */
export function parsePeriod(value: unknown): DashboardPeriod {
  return value === "lalu" ? "previous" : "current";
}

/** "bulan" untuk mode kalender, "periode" untuk siklus gajian (COPY: Arus bulan ini / Arus periode ini). */
export function periodNoun(calendar: boolean): "bulan" | "periode" {
  return calendar ? "bulan" : "periode";
}
