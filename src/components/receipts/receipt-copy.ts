export const RECEIPT_PATH = "/struk";

export function receiptHref(scope: string | null, attachmentId?: string): string {
  const params = new URLSearchParams();
  if (attachmentId) params.set("lampiran", attachmentId);
  if (scope === "partner" || scope === "all") params.set("scope", scope);
  const query = params.toString();
  return query ? `${RECEIPT_PATH}?${query}` : RECEIPT_PATH;
}

export const SETUP_RECEIPT_COPY = {
  title: "Foto struk butuh model vision",
  body: "Struk dibaca oleh model AI yang bisa membaca gambar. Pasang model vision di pengaturan AI, lalu tombol ini langsung membuka kamera. Sementara itu, ketik transaksinya di bar, misalnya kopi 25rb gopay.",
} as const;

// ARCHITECTURE 9: foto struk tidak diproses saat offline, UI menjelaskan alasannya
export const OFFLINE_RECEIPT_COPY = {
  title: "Foto struk butuh koneksi",
  body: "Foto struk dibaca oleh model AI lewat server, jadi tidak bisa diproses saat offline. Sambungkan internet lalu coba lagi, atau ketik transaksinya di bar, misalnya kopi 25rb gopay. Transaksi yang diketik tetap tersimpan di perangkat.",
} as const;
