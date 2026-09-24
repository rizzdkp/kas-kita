import { formatShortDate, parseDateKey } from "@/lib/dates";

/** "12 Sep" dari kunci hari; kunci tidak valid ditampilkan apa adanya. */
export function shortDateFromKey(key: string): string {
  const d = parseDateKey(key);
  return d ? formatShortDate(d) : key;
}
