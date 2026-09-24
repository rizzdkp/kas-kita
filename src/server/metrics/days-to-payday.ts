import { dateKey, daysUntil, nextPayday } from "@/lib/dates";
import type { Metric } from "./types";

export interface PaydayPerson {
  userId: string;
  name: string;
  paydayDay: number;
}

export interface DaysToPayday extends Metric<number> {
  /** Kunci hari WIB gajian berikutnya. */
  nextPayday: string;
  /** Pemilik gajian terdekat (bisa dua orang kalau jatuh di hari yang sama). */
  userIds: string[];
}

/** Gabungan memakai gajian terdekat dari kedua pengguna (PRD bagian 6). Gajian hari ini dihitung 0 hari. */
export function daysToPayday(people: PaydayPerson[], now: Date): DaysToPayday {
  if (people.length === 0) throw new RangeError("Minimal satu pengguna untuk menghitung gajian");
  const candidates = people.map((p) => ({ p, date: nextPayday(p.paydayDay, now) }));
  const days = Math.min(...candidates.map((c) => daysUntil(c.date, now)));
  const nearest = candidates.filter((c) => daysUntil(c.date, now) === days);
  const next = dateKey(nearest[0]!.date);
  const inputs: Record<string, number | string> = { "Hari ini": dateKey(now), "Gajian berikutnya": next };
  for (const c of candidates) inputs[`Tanggal gajian ${c.p.name}`] = c.p.paydayDay;
  return {
    value: days,
    formula:
      people.length > 1
        ? "Hari menuju gajian = gajian terdekat dari kalian berdua − hari ini (WIB)"
        : "Hari menuju gajian = tanggal gajian berikutnya − hari ini (WIB)",
    inputs,
    nextPayday: next,
    userIds: nearest.map((c) => c.p.userId),
  };
}
