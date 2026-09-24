"use client";

import type { ReactNode } from "react";
import type { Scope } from "@/lib/scope";
import { GlassSurface } from "@/components/glass/glass-surface";
import { ScopeToggle } from "@/components/glass/scope-toggle";
import { NotificationsButton } from "./notifications-button";
import { UserMenu } from "./user-menu";
import type { ShellViewer } from "./types";
import { useScrolled } from "./use-scrolled";

type ToolbarProps = {
  title: string;
  viewer: ShellViewer;
  scope: Scope;
  onScopeChange: (scope: Scope) => void;
  periodSlot?: ReactNode;
  notificationsSlot?: ReactNode;
  onSignOut?: () => void;
};

/** Toolbar glass atas (>=600px). Judul tampil di sini mulai 1024px; di bawahnya judul pindah ke konten. */
export function Toolbar({ title, viewer, scope, onScopeChange, periodSlot, notificationsSlot, onSignOut }: ToolbarProps) {
  const scrolled = useScrolled();
  return (
    <GlassSurface
      as="header"
      scrolled={scrolled}
      className="sticky top-3 z-20 hidden h-15 items-center gap-2 pl-6 pr-2 sm:flex"
    >
      <h1 className="hidden min-w-0 flex-1 truncate text-title text-primary lg:block">{title}</h1>
      {viewer.partner ? (
        <ScopeToggle value={scope} onChange={onScopeChange} partnerName={viewer.partner.name} />
      ) : null}
      <div className="flex-1 lg:hidden" />
      {periodSlot ? <div className="flex shrink-0 items-center">{periodSlot}</div> : null}
      <NotificationsButton>{notificationsSlot}</NotificationsButton>
      <UserMenu me={viewer.me} onSignOut={onSignOut} />
    </GlassSurface>
  );
}

/** Bar glass atas di layar kecil: hanya toggle cakupan dan menu akun supaya konten tetap dominan. */
export function MobileTopBar({
  viewer,
  scope,
  onScopeChange,
  onSignOut,
}: Pick<ToolbarProps, "viewer" | "scope" | "onScopeChange" | "onSignOut">) {
  const scrolled = useScrolled();
  return (
    <GlassSurface
      as="header"
      scrolled={scrolled}
      className="sticky top-[calc(8px+env(safe-area-inset-top))] z-20 flex h-13 items-center gap-1 p-1 sm:hidden"
    >
      {viewer.partner ? (
        <ScopeToggle
          value={scope}
          onChange={onScopeChange}
          partnerName={viewer.partner.name}
          className="min-w-0 flex-1"
        />
      ) : (
        <span className="flex-1 px-3 text-control font-semibold text-primary">Kas Kita</span>
      )}
      <UserMenu me={viewer.me} onSignOut={onSignOut} />
    </GlassSurface>
  );
}
