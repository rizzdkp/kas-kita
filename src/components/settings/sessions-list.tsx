import { Laptop, Smartphone, Tablet, type LucideIcon } from "lucide-react";
import type { ActiveSession } from "@/server/auth/session";
import { formatRelativeDay, formatTime } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { RevokeSessionButton } from "./revoke-session-button";
import { describeUserAgent, type DeviceKind } from "./user-agent";

const DEVICE_ICON: Record<DeviceKind, LucideIcon> = { phone: Smartphone, tablet: Tablet, desktop: Laptop, unknown: Laptop };

function when(date: Date, now: Date): string {
  return `${formatRelativeDay(date, now)} ${formatTime(date)}`;
}

/** Daftar sesi aktif F-AUTH-1 AC4; sesi sekarang di atas supaya mudah dikenali. */
export function SessionsList({ sessions, now = new Date() }: { sessions: ActiveSession[]; now?: Date }) {
  const ordered = [...sessions].sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent));
  if (ordered.length === 0) {
    return <p className="text-body text-secondary">Tidak ada sesi aktif lain. Muat ulang halaman kalau baru masuk dari perangkat lain.</p>;
  }
  return (
    <ul aria-label="Sesi aktif" className="flex flex-col">
      {ordered.map((session) => {
        const device = describeUserAgent(session.userAgent);
        return (
          <li
            key={session.id}
            className="flex flex-col gap-3 border-b border-border py-4 first:pt-0 last:border-b-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex min-w-0 items-start gap-3">
              <Icon icon={DEVICE_ICON[device.kind]} className="mt-0.5 shrink-0 text-secondary" />
              <div className="flex min-w-0 flex-col gap-1">
                <p className="flex flex-wrap items-center gap-2 text-control text-primary">
                  {device.label}
                  {session.isCurrent ? <Badge>Perangkat ini</Badge> : null}
                </p>
                <p className="text-small text-secondary">
                  {session.trusted ? "Perangkat tepercaya, sesi 30 hari" : "Sesi 12 jam"}
                  {session.ipAddress ? <> · IP <span className="tabular">{session.ipAddress}</span></> : null}
                </p>
                <p className="text-small text-secondary">
                  Aktif terakhir <time dateTime={session.lastActiveAt.toISOString()}>{when(session.lastActiveAt, now)}</time> · Berakhir{" "}
                  <time dateTime={session.expiresAt.toISOString()}>{when(session.expiresAt, now)}</time>
                </p>
              </div>
            </div>
            <div className="pl-8 sm:pl-0">
              <RevokeSessionButton sessionId={session.id} deviceLabel={device.label} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
