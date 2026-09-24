"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
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
  /** Teks terkendali; tanpa ini bar menyimpan teksnya sendiri. */
  value?: string;
  onValueChange?: (text: string) => void;
  /** Esc di dalam bar, misalnya untuk menutup kartu pratinjau. */
  onEscape?: () => void;
  /** File dari tombol kamera. */
  onPhoto?: (file: File) => void;
  /** Kalau diisi, tombol kamera memanggil ini alih-alih membuka pemilih file (model vision belum ada). */
  onCameraClick?: () => void;
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
  value,
  onValueChange,
  onEscape,
  onPhoto,
  onCameraClick,
  busy = false,
  children,
  className,
}: QuickAddBarProps) {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [innerText, setInnerText] = useState("");
  const text = value ?? innerText;
  const setText = (next: string) => {
    if (value === undefined) setInnerText(next);
    onValueChange?.(next);
  };
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

  // tinggi mengikuti isi supaya beberapa baris (F-IN-2 AC4) tetap terlihat, maksimal empat baris
  useLayoutEffect(() => {
    const node = inputRef.current;
    if (!node) return;
    node.style.height = "auto";
    // placeholder panjang tidak boleh ikut menumbuhkan bar
    if (text) node.style.height = `${Math.min(node.scrollHeight, 96)}px`;
  }, [text]);

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
        className="flex min-h-13 items-center gap-2 pl-4 pr-1"
      >
        {forPartner && partnerColor ? (
          <IdentityDot color={partnerColor} label={`Dicatat atas nama ${partnerName}`} />
        ) : null}
        <label htmlFor={inputId} className="sr-only">
          Catat transaksi
        </label>
        <textarea
          ref={inputRef}
          id={inputId}
          rows={1}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && onEscape) {
              event.preventDefault();
              onEscape();
              return;
            }
            // Enter mengirim; Shift+Enter menambah baris untuk beberapa transaksi sekaligus
            if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }}
          placeholder={placeholder}
          disabled={busy}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="done"
          aria-keyshortcuts="/ Control+K Meta+K"
          aria-describedby={`${inputId}-hint`}
          className="block max-h-24 min-w-0 flex-1 resize-none bg-transparent py-3.5 placeholder-shown:overflow-hidden placeholder-shown:text-ellipsis placeholder-shown:whitespace-nowrap text-body font-medium text-primary outline-none placeholder:text-secondary disabled:opacity-(--disabled-opacity)"
        />
        <span id={`${inputId}-hint`} className="sr-only">
          Enter untuk pratinjau. Shift+Enter untuk baris baru, satu transaksi per baris.
        </span>
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
          onClick={() => (onCameraClick ? onCameraClick() : fileRef.current?.click())}
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
