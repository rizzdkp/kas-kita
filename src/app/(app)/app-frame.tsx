"use client";

import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import type { ShellViewer } from "@/components/shell/types";
import { signOutAction } from "@/server/auth/actions";

type AppFrameProps = {
  viewer: ShellViewer;
  children: ReactNode;
};

/** Jembatan klien antara layout server dan AppShell: tempat perilaku global (quick-add, notifikasi). */
export function AppFrame({ viewer, children }: AppFrameProps) {
  return (
    <AppShell viewer={viewer} onSignOut={() => void signOutAction()}>
      {children}
    </AppShell>
  );
}
