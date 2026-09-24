"use client";

import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import type { ShellViewer } from "@/components/shell/types";
import type { QuickAddContextData } from "@/components/quick-add/types";
import { useQuickAddShell } from "@/components/quick-add/use-quick-add-shell";
import { signOutAction } from "@/server/auth/actions";

type AppFrameProps = {
  viewer: ShellViewer;
  quickAdd: QuickAddContextData;
  children: ReactNode;
};

/** Jembatan klien antara layout server dan AppShell: tempat perilaku global (quick-add, notifikasi). */
export function AppFrame({ viewer, quickAdd, children }: AppFrameProps) {
  const quickAddProps = useQuickAddShell(quickAdd, { me: viewer.me.color, partner: viewer.partner?.color ?? null });
  return (
    <AppShell viewer={viewer} onSignOut={() => void signOutAction()} {...quickAddProps}>
      {children}
    </AppShell>
  );
}
