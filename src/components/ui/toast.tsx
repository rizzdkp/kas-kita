"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Undo2, X } from "lucide-react";
import { GlassSurface } from "@/components/glass/glass-surface";
import { cn } from "./cn";
import { Icon } from "./icon";

export type ToastAction = { label: string; onAction: () => void };

export type ToastOptions = {
  title: string;
  description?: string;
  /** Aksi tunggal, biasanya "Urungkan". */
  action?: ToastAction;
  /** Milidetik; bawaan 5000 (jendela urungkan). */
  duration?: number;
};

type ToastItem = ToastOptions & { id: number; open: boolean };

type ToastApi = {
  show: (options: ToastOptions) => number;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const DEFAULT_DURATION = 5000;
const MAX_VISIBLE = 3;

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast harus dipakai di dalam ToastProvider");
  return api;
}

/**
 * Toast glass di bawah tengah. Posisi vertikal dibaca dari --toast-offset yang diisi AppShell
 * supaya toast tidak menutupi bar quick-add dan tab bar.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.map((t) => (t.id === id ? { ...t, open: false } : t)));
  }, []);

  const remove = useCallback((id: number) => {
    setItems((list) => list.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((options: ToastOptions) => {
    const id = nextId.current++;
    setItems((list) => [...list, { ...options, id, open: true }].slice(-MAX_VISIBLE));
    return id;
  }, []);

  const api = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-relevant="additions text"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--toast-offset,24px)+env(safe-area-inset-bottom))] z-60 flex flex-col items-center gap-2 px-3"
      >
        {items.map((item) => (
          <ToastCard key={item.id} item={item} onDismiss={dismiss} onRemove={remove} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({
  item,
  onDismiss,
  onRemove,
}: {
  item: ToastItem;
  onDismiss: (id: number) => void;
  onRemove: (id: number) => void;
}) {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(item.duration ?? DEFAULT_DURATION);

  useEffect(() => {
    if (!item.open || paused) return;
    const started = Date.now();
    const timer = window.setTimeout(() => onDismiss(item.id), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current -= Date.now() - started;
    };
  }, [item.open, item.id, paused, onDismiss]);

  // cadangan kalau animationend tidak pernah datang (animasi dimatikan browser)
  useEffect(() => {
    if (item.open) return;
    const timer = window.setTimeout(() => onRemove(item.id), 400);
    return () => window.clearTimeout(timer);
  }, [item.open, item.id, onRemove]);

  return (
    <GlassSurface
      variant="regular"
      role="status"
      data-state={item.open ? "open" : "closed"}
      onAnimationEnd={() => {
        if (!item.open) onRemove(item.id);
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="kk-toast pointer-events-auto flex w-full max-w-[420px] items-center gap-2 py-2 pl-4 pr-2"
    >
      <div className="flex min-w-0 flex-1 flex-col py-1">
        <p className="text-control text-primary">{item.title}</p>
        {item.description ? <p className="text-control text-secondary">{item.description}</p> : null}
      </div>
      {item.action ? (
        <button
          type="button"
          onClick={() => {
            item.action?.onAction();
            onDismiss(item.id);
          }}
          className={cn(
            "inline-flex h-11 shrink-0 items-center gap-2 rounded-md px-3 text-control text-primary sm:h-10",
            "transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-glass-active",
          )}
        >
          <Icon icon={Undo2} />
          {item.action.label}
        </button>
      ) : null}
      <button
        type="button"
        aria-label="Tutup"
        onClick={() => onDismiss(item.id)}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-secondary transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-glass-active hover:text-primary sm:size-10"
      >
        <Icon icon={X} />
      </button>
    </GlassSurface>
  );
}
