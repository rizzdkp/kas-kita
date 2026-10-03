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
  /** Aset kepala halaman di kiri judul (>=1024px). */
  titleArt?: ReactNode;
  viewer: ShellViewer;
  scope: Scope;
  onScopeChange: (scope: Scope) => void;
  periodSlot?: ReactNode;
  notificationsSlot?: ReactNode;
  notificationsUnread?: number;
  onSignOut?: () => void;
};

/** Toolbar glass atas (>=600px). Judul tampil di sini mulai 1024px; di bawahnya judul pindah ke konten. */
export function Toolbar({ title, titleArt, viewer, scope, onScopeChange, periodSlot, notificationsSlot, notificationsUnread, onSignOut }: ToolbarProps) {
  const scrolled = useScrolled();
  return (
    <GlassSurface
      as="header"
      scrolled={scrolled}
      className="sticky top-3 z-20 hidden h-15 items-center gap-2 pl-6 pr-2 sm:flex"
    >
      <div className="hidden min-w-0 flex-1 items-center gap-3 lg:flex">
        {titleArt}
        <h1 className="min-w-0 truncate text-title text-primary">{title}</h1>
      </div>
      {viewer.partner ? (
        <ScopeToggle value={scope} onChange={onScopeChange} partnerName={viewer.partner.name} />
      ) : null}
      <div className="flex-1 lg:hidden" />
      {periodSlot ? <div className="flex shrink-0 items-center">{periodSlot}</div> : null}
      <NotificationsButton unread={notificationsUnread}>{notificationsSlot}</NotificationsButton>
      <UserMenu me={viewer.me} onSignOut={onSignOut} notificationsUnread={notificationsUnread} showNotifications />
    </GlassSurface>
  );
}

/** Bar glass atas di layar kecil: hanya toggle cakupan dan menu akun supaya konten tetap dominan. */
export function MobileTopBar({
  viewer,
  scope,
  onScopeChange,
  onSignOut,
  notificationsUnread,
}: Pick<ToolbarProps, "viewer" | "scope" | "onScopeChange" | "onSignOut" | "notificationsUnread">) {
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
      <UserMenu me={viewer.me} onSignOut={onSignOut} notificationsUnread={notificationsUnread} showNotifications />
    </GlassSurface>
  );
}
