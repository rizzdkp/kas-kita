// file dari tombol kamera diserahkan ke halaman /struk tanpa lewat URL; hilang saat halaman dimuat ulang
let pending: File | null = null;
const listeners = new Set<() => void>();

export function setPendingReceiptFile(file: File): void {
  pending = file;
  for (const listener of listeners) listener();
}

export function takePendingReceiptFile(): File | null {
  const file = pending;
  pending = null;
  return file;
}

/** Halaman /struk yang sudah terbuka ikut menerima foto baru dari tombol kamera. */
export function subscribePendingReceiptFile(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
