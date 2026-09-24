"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Camera, LoaderCircle } from "lucide-react";
import type { Scope } from "@/lib/scope";
import { cn } from "@/components/ui/cn";
import { Icon } from "@/components/ui/icon";
import { IdentityDot } from "@/components/identity/identity-dot";
import type { IdentityColor } from "@/components/identity/identity-colors";
import { GlassSurface } from "./glass-surface";

export const FOCUS_QUICK_ADD_EVENT = "kaskita:focus-quick-add";

/** Memfokuskan bar quick-add dari mana saja (tombol tambah, state kosong Transaksi). */
export function focusQuickAdd(): void {
  window.dispatchEvent(new Event(FOCUS_QUICK_ADD_EVENT));
}

type QuickAddBarProps = {
  scope: Scope;
  partnerName?: string | null;
  partnerColor?: IdentityColor | null;
  /** Enter. Parsing ditangani pemanggil (M1). */
  onSubmit?: (text: string) => void;
  /** File dari tombol kamera. */
  onPhoto?: (file: File) => void;
  /** Sedang menunggu parser atau AI: input dikunci dan spinner tampil. */
  busy?: boolean;
  /** Slot di atas bar: kartu pratinjau, pesan. */
  children?: ReactNode;
  className?: string;
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function QuickAddBar({
  scope,
  partnerName,
  partnerColor,
  onSubmit,
  onPhoto,
  busy = false,
  children,
  className,
}: QuickAddBarProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [text, setText] = useState("");
  const inputId = useId();
  const forPartner = scope === "partner" && Boolean(partnerName);

  useEffect(() => {
    const focus = () => inputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      const cmdK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      const slash = event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey && !isTypingTarget(event.target);
      if (cmdK || slash) {
        event.preventDefault();
        focus();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(FOCUS_QUICK_ADD_EVENT, focus);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(FOCUS_QUICK_ADD_EVENT, focus);
    };
  }, []);

  const placeholder = forPartner ? `Catat untuk ${partnerName}, misalnya makan 40rb` : "kopi 25rb gopay";

  return (
    <div className={cn("flex w-full flex-col gap-2", className)}>
      {children}
      <GlassSurface
        as="form"
        variant="bar"
        aria-label="Catat transaksi"
        onSubmit={(event: React.FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          const value = text.trim();
          if (!value || busy) return;
          onSubmit?.(value);
        }}
        className="flex h-13 items-center gap-2 pl-4 pr-1"
      >
        {forPartner && partnerColor ? (
          <IdentityDot color={partnerColor} label={`Dicatat atas nama ${partnerName}`} />
        ) : null}
        <label htmlFor={inputId} className="sr-only">
          Catat transaksi
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={placeholder}
          disabled={busy}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="done"
          aria-keyshortcuts="/ Control+K Meta+K"
          className="h-full min-w-0 flex-1 bg-transparent text-body font-medium text-primary outline-none placeholder:text-secondary disabled:opacity-(--disabled-opacity)"
        />
        {busy ? (
          <span role="status" className="inline-flex size-11 items-center justify-center text-secondary">
            <Icon icon={LoaderCircle} className="kk-spin" />
            <span className="sr-only">Memproses</span>
          </span>
        ) : null}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          tabIndex={-1}
          aria-hidden
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onPhoto?.(file);
            event.target.value = "";
          }}
        />
        <button
          type="button"
          aria-label="Foto struk"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className={cn(
            "inline-flex size-11 shrink-0 items-center justify-center rounded-pill text-secondary",
            "transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-glass-active hover:text-primary",
            "disabled:opacity-(--disabled-opacity)",
          )}
        >
          <Icon icon={Camera} />
        </button>
      </GlassSurface>
    </div>
  );
}
