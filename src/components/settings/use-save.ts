"use client";

import { useTransition } from "react";
import { useToast } from "@/components/ui/toast";
import type { ActionError, ActionResult } from "@/server/actions/result";

type SaveOptions<T> = {
  /** Bawaan "Tersimpan" (COPY: tombol Simpan, toast Tersimpan); null kalau pemanggil menampilkan toast sendiri. */
  successTitle?: string | null;
  onSuccess?: (data: T) => void;
  /** Kalau diisi, error tidak ditampilkan sebagai toast; misalnya error field ditaruh di bawah input. */
  onError?: (error: ActionError) => void;
};

/** Jalankan server action, tampilkan toast hasilnya, dan laporkan status pending untuk tombol. */
export function useSave() {
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  function save<T>(run: () => Promise<ActionResult<T>>, options: SaveOptions<T> = {}) {
    startTransition(async () => {
      const result = await run();
      if (result.ok) {
        if (options.successTitle !== null) toast.show({ title: options.successTitle ?? "Tersimpan" });
        options.onSuccess?.(result.data);
        return;
      }
      if (options.onError) options.onError(result);
      else toast.show({ title: result.error });
    });
  }

  return { pending, save };
}

export function firstFieldError(error: ActionError | null, field: string): string | null {
  return error?.fieldErrors?.[field]?.[0] ?? null;
}

/** Pesan umum hanya kalau error tidak menempel di salah satu field yang terlihat di form. */
export function formLevelError(error: ActionError | null, fields: readonly string[]): string | null {
  if (!error) return null;
  return fields.some((f) => error.fieldErrors?.[f]?.length) ? null : error.error;
}
