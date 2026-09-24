"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { PopoverClose } from "@/components/ui/popover";
import { loadNotificationsAction, markNotificationsReadAction, type NotificationFeed, type NotificationItem } from "@/server/actions/notifications";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNotificationTime } from "./format-time";

type NotificationsPanelProps = {
  /** Dipanggil setiap jumlah belum dibaca berubah, supaya titik di NotificationsButton ikut. */
  onUnreadChange?: (unread: number) => void;
  /** Nama partner untuk keterangan state kosong. */
  partnerName?: string;
  /** Matikan kalau panel dipakai di luar Popover (tautan tidak menutup popover). */
  inPopover?: boolean;
};

type State = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; feed: NotificationFeed };

/** Isi popover NotificationsButton: memuat saat dibuka supaya daftar selalu terbaru. */
export function NotificationsPanel({ onUnreadChange, partnerName, inPopover = true }: NotificationsPanelProps) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [marking, startMarking] = useTransition();
  // ref supaya callback inline dari induk tidak memicu muat ulang di setiap render
  const unreadListener = useRef(onUnreadChange);
  useEffect(() => {
    unreadListener.current = onUnreadChange;
  });

  const load = useCallback(async () => {
    const result = await loadNotificationsAction();
    if (!result.ok) {
      setState({ status: "error", message: result.error });
      return;
    }
    setState({ status: "ready", feed: result.data });
    unreadListener.current?.(result.data.unread);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function markRead(ids?: string[]) {
    if (state.status !== "ready") return;
    const target = new Set(ids ?? state.feed.items.map((i) => i.id));
    const items = state.feed.items.map((i) => (target.has(i.id) ? { ...i, read: true } : i));
    const unread = Math.max(0, state.feed.unread - state.feed.items.filter((i) => target.has(i.id) && !i.read).length);
    setState({ status: "ready", feed: { items, unread: ids ? unread : 0 } });
    unreadListener.current?.(ids ? unread : 0);
    startMarking(async () => {
      const result = await markNotificationsReadAction(ids);
      if (result.ok) unreadListener.current?.(result.data.unread);
    });
  }

  const unread = state.status === "ready" ? state.feed.unread : 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-10 items-center justify-between gap-2">
        <h2 className="text-control text-primary">Notifikasi</h2>
        <Button variant="ghost" className="-mr-2 px-2" disabled={unread === 0} loading={marking} onClick={() => markRead()}>
          Tandai semua dibaca
        </Button>
      </div>
      {state.status === "loading" ? (
        <div aria-busy className="flex flex-col gap-3 py-1">
          <span className="sr-only">Memuat notifikasi</span>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-4/5" />
        </div>
      ) : state.status === "error" ? (
        <div className="flex flex-col items-start gap-2 py-2">
          <p className="text-control text-primary">Notifikasi belum bisa dimuat. {state.message}</p>
          <Button variant="secondary" onClick={() => void load()}>
            Coba lagi
          </Button>
        </div>
      ) : state.feed.items.length === 0 ? (
        <p className="py-2 text-control text-secondary">
          Belum ada notifikasi. Kabar muncul di sini saat {partnerName ?? "partner"} mengubah data milikmu, tagihan jatuh tempo 3 hari lagi, atau anggaran wajib
          lewat.
        </p>
      ) : (
        <ul aria-label="Daftar notifikasi" className="-mx-2 flex max-h-[min(420px,60dvh)] flex-col overflow-y-auto">
          {state.feed.items.map((item) => (
            <li key={item.id}>
              <NotificationRow item={item} inPopover={inPopover} onOpen={() => !item.read && markRead([item.id])} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NotificationRow({ item, inPopover, onOpen }: { item: NotificationItem; inPopover: boolean; onOpen: () => void }) {
  const body = (
    <>
      <span aria-hidden className={cn("mt-2 size-2 shrink-0 rounded-pill", item.read ? "bg-transparent" : "bg-accent")} />
      <span className="flex min-w-0 flex-col gap-0.5">
        {item.read ? null : <span className="sr-only">Belum dibaca. </span>}
        <span className="text-control text-primary">{item.message}</span>
        <time dateTime={item.createdAt.toISOString()} className="text-control font-normal text-secondary">
          {formatNotificationTime(item.createdAt)}
        </time>
      </span>
    </>
  );
  const rowClass = "flex w-full gap-3 rounded-md px-2 py-2 text-left";
  if (!item.href) {
    return (
      <button type="button" onClick={onOpen} className={cn(rowClass, "hover:bg-glass-active")}>
        {body}
      </button>
    );
  }
  const link = (
    <Link href={item.href} onClick={onOpen} className={cn(rowClass, "no-underline hover:bg-glass-active")}>
      {body}
    </Link>
  );
  return inPopover ? <PopoverClose asChild>{link}</PopoverClose> : link;
}
