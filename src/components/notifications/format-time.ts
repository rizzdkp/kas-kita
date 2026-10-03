import { formatRelativeDay, formatTime } from "@/lib/dates";

/** "Baru saja", "12 menit lalu", "Hari ini 09.12", "Kemarin 20.14", lalu tanggal (COPY 3: relatif). */
export function formatNotificationTime(date: Date, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return "Baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;
  const day = formatRelativeDay(date, now);
  return day === "Hari ini" || day === "Kemarin" ? `${day} ${formatTime(date)}` : day;
}
