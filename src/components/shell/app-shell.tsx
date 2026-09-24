"use client";

import { useCallback, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { parseScope, type Scope } from "@/lib/scope";
import { AmbientField } from "@/components/glass/ambient-field";
import { QuickAddBar, focusQuickAdd } from "@/components/glass/quick-add-bar";
import { ToastProvider } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { titleForPath } from "./nav-items";
import { Sidebar } from "./sidebar";
import { TabBar } from "./tab-bar";
import { MobileTopBar, Toolbar } from "./toolbar";
import type { ShellViewer } from "./types";

export type AppShellProps = {
  viewer: ShellViewer;
  children: ReactNode;
  /** Bawaan: label item nav yang cocok dengan path. */
  title?: string;
  /** Kontrol periode. Dirender di toolbar (>=600px) dan di kepala konten (<600px), jadi harus terkendali. */
  periodSlot?: ReactNode;
  notificationsSlot?: ReactNode;
  notificationsUnread?: number;
  onSignOut?: () => void;
  onQuickAddSubmit?: (text: string, scope: Scope) => void;
  onReceiptPhoto?: (file: File) => void;
  onReceiptClick?: () => void;
  /** Slot di atas bar quick-add (kartu pratinjau). */
  quickAddSlot?: ReactNode;
  quickAddBusy?: boolean;
  /** Teks bar quick-add terkendali (dikosongkan setelah pratinjau, dipulihkan saat batal). */
  quickAddValue?: string;
  onQuickAddValueChange?: (text: string) => void;
  onQuickAddEscape?: () => void;
};

/** Cakupan hidup di URL (?scope=) supaya tautan bisa dibagikan (F-SCOPE-1 AC4). */
function useScopeParam(): [Scope, (scope: Scope) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const scope = parseScope(params.get("scope"));
  const setScope = useCallback(
    (next: Scope) => {
      const search = new URLSearchParams(params.toString());
      if (next === "me") search.delete("scope");
      else search.set("scope", next);
      const query = search.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );
  return [scope, setScope];
}

/**
 * Shell app: medan ambien, sidebar glass (>=600), toolbar glass, bar quick-add, tab bar glass (<600).
 * Maksimal tiga glass tetap per layar: sidebar + toolbar + quick-add, atau bar atas + quick-add + tab bar.
 * Pemakai useSearchParams: bungkus dengan <Suspense> di layout.
 */
export function AppShell({
  viewer,
  children,
  title,
  periodSlot,
  notificationsSlot,
  notificationsUnread,
  onSignOut,
  onQuickAddSubmit,
  onReceiptPhoto,
  onReceiptClick,
  quickAddSlot,
  quickAddBusy,
  quickAddValue,
  onQuickAddValueChange,
  onQuickAddEscape,
}: AppShellProps) {
  const pathname = usePathname();
  const [scope, setScope] = useScopeParam();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const pageTitle = title ?? titleForPath(pathname);
  const effectiveScope: Scope = viewer.partner ? scope : "me";

  return (
    <TooltipProvider delayDuration={400}>
      <ToastProvider>
        <div className="relative min-h-dvh [--toast-offset:144px] sm:[--toast-offset:76px]">
          <AmbientField scope={effectiveScope} meColor={viewer.me.color} partnerColor={viewer.partner?.color} />

          <a
            href="#konten"
            className="sr-only z-50 rounded-md bg-surface px-4 py-2 text-control text-primary focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
          >
            Lewati ke konten
          </a>

          <Sidebar pathname={pathname} expanded={sidebarExpanded} onExpandedChange={setSidebarExpanded} />

          <div className="relative z-10 px-3 pb-[calc(168px+env(safe-area-inset-bottom))] sm:pb-24 sm:pl-[calc(var(--sidebar-rail)+24px)] lg:pl-[calc(var(--sidebar-width)+24px)]">
            <div className="pt-[env(safe-area-inset-top)] sm:pt-3">
              <MobileTopBar
                viewer={viewer}
                scope={effectiveScope}
                onScopeChange={setScope}
                onSignOut={onSignOut}
                notificationsUnread={notificationsUnread}
              />
              <Toolbar
                title={pageTitle}
                viewer={viewer}
                scope={effectiveScope}
                onScopeChange={setScope}
                periodSlot={periodSlot}
                notificationsSlot={notificationsSlot}
                notificationsUnread={notificationsUnread}
                onSignOut={onSignOut}
              />
            </div>

            <main id="konten" tabIndex={-1} className="mx-auto w-full max-w-(--content-max) outline-none">
              <div className="flex flex-wrap items-center justify-between gap-3 px-1 pb-2 pt-6 lg:hidden">
                <h1 className="text-title text-primary">{pageTitle}</h1>
                {periodSlot ? <div className="sm:hidden">{periodSlot}</div> : null}
              </div>
              <div className="pt-4 lg:pt-8">{children}</div>
            </main>
          </div>

          <div className="pointer-events-none fixed inset-x-3 bottom-[calc(84px+env(safe-area-inset-bottom))] z-30 flex justify-center sm:bottom-3 sm:left-[calc(var(--sidebar-rail)+24px)] lg:left-[calc(var(--sidebar-width)+24px)]">
            <QuickAddBar
              scope={effectiveScope}
              partnerName={viewer.partner?.name}
              partnerColor={viewer.partner?.color}
              onSubmit={(text) => onQuickAddSubmit?.(text, effectiveScope)}
              onPhoto={onReceiptPhoto}
              onCameraClick={onReceiptClick}
              busy={quickAddBusy}
              value={quickAddValue}
              onValueChange={onQuickAddValueChange}
              onEscape={onQuickAddEscape}
              className="pointer-events-auto max-w-(--quick-add-max)"
            >
              {quickAddSlot}
            </QuickAddBar>
          </div>

          <TabBar pathname={pathname} onAdd={focusQuickAdd} />
        </div>
      </ToastProvider>
    </TooltipProvider>
  );
}
