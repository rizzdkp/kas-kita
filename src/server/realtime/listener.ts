import { z } from "zod";
import { sql } from "@/server/db/client";
import { CHANGES_CHANNEL, type ChangeEvent } from "./publish";

const eventSchema = z.object({ entity: z.string().min(1).max(64), id: z.string().min(1).max(64) });

export type ChangeListener = (event: ChangeEvent) => void;

type Hub = { listeners: Set<ChangeListener>; ready: Promise<void> | null };
// satu koneksi LISTEN per proses server, dipakai bersama semua klien SSE (ARCHITECTURE 8)
const holder = globalThis as unknown as { kaskitaChangeHub?: Hub };
const hub: Hub = (holder.kaskitaChangeHub ??= { listeners: new Set(), ready: null });

function dispatch(raw: string): void {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return;
  }
  const parsed = eventSchema.safeParse(json);
  if (!parsed.success) return;
  for (const listener of hub.listeners) {
    try {
      listener(parsed.data);
    } catch {
      // satu klien yang rusak tidak boleh menghentikan klien lain
    }
  }
}

function ensureListening(): Promise<void> {
  // postgres-js memakai satu koneksi khusus untuk LISTEN dan menyambung ulang sendiri kalau putus
  hub.ready ??= sql.listen(CHANGES_CHANNEL, dispatch).then(
    () => undefined,
    (e: unknown) => {
      hub.ready = null;
      throw e;
    },
  );
  return hub.ready;
}

/** Daftarkan pendengar perubahan; kembalikan fungsi untuk berhenti. */
export async function subscribeChanges(listener: ChangeListener): Promise<() => void> {
  hub.listeners.add(listener);
  try {
    await ensureListening();
  } catch (e) {
    hub.listeners.delete(listener);
    throw e;
  }
  return () => {
    hub.listeners.delete(listener);
  };
}

export function changeListenerCount(): number {
  return hub.listeners.size;
}
