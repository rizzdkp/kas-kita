"use client";

import { useEffect, useState, type ReactNode } from "react";
import { NotificationsPanel } from "@/components/notifications";
import { AppShell } from "@/components/shell/app-shell";
import type { ShellViewer } from "@/components/shell/types";
import type { QuickAddContextData } from "@/components/quick-add/types";
import { useQuickAddShell } from "@/components/quick-add/use-quick-add-shell";
import { signOutAction } from "@/server/auth/actions";

type AppFrameProps = {
  viewer: ShellViewer;
  quickAdd: QuickAddContextData;
  unread: number;
  children: ReactNode;
};

/** Jembatan klien antara layout server dan AppShell: tempat perilaku global (quick-add, notifikasi). */
export function AppFrame({ viewer, quickAdd, unread, children }: AppFrameProps) {
  const quickAddProps = useQuickAddShell(quickAdd, { me: viewer.me.color, partner: viewer.partner?.color ?? null });
  const [unreadCount, setUnreadCount] = useState(unread);
  useEffect(() => setUnreadCount(unread), [unread]);
  return (
    <AppShell
      viewer={viewer}
      onSignOut={() => void signOutAction()}
      notificationsSlot={<NotificationsPanel partnerName={viewer.partner?.name} onUnreadChange={setUnreadCount} />}
      notificationsUnread={unreadCount}
      {...quickAddProps}
    >
      {children}
    </AppShell>
  );
}
