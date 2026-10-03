"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/server/actions/result";

export type ActionState = { error: string | null; fieldErrors: Record<string, string[]> };

/** Jalankan server action, simpan error untuk ditampilkan di form, panggil onSuccess kalau berhasil. */
export function useActionRunner() {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<ActionState>({ error: null, fieldErrors: {} });

  function run<T>(action: () => Promise<ActionResult<T>>, onSuccess: (data: T) => void) {
    setState({ error: null, fieldErrors: {} });
    startTransition(async () => {
      const result = await action();
      if (result.ok) onSuccess(result.data);
      else setState({ error: result.error, fieldErrors: result.fieldErrors ?? {} });
    });
  }

  function fieldError(name: string): string | null {
    return state.fieldErrors[name]?.[0] ?? null;
  }

  function reset() {
    setState({ error: null, fieldErrors: {} });
  }

  return { pending, error: state.error, fieldError, run, reset };
}
