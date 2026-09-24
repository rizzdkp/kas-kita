// PRD F-IN-3 AC1: sisi terpanjang 1600 px, JPEG kualitas 0,8 sebelum diunggah
export const COMPRESS_MAX_EDGE = 1600;
export const COMPRESS_QUALITY = 0.8;

/** Ukuran baru yang muat di kotak max x max tanpa memperbesar. */
export function fitWithin(width: number, height: number, max: number = COMPRESS_MAX_EDGE): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max || longest === 0) return { width, height };
  const scale = max / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * Kompres di browser lewat canvas. Kalau browser tidak bisa membuka formatnya (HEIC di Chrome),
 * file asli dikirim dan server yang mendekode ulang.
 */
export async function compressReceiptImage(file: Blob): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }
  const size = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", COMPRESS_QUALITY));
  return blob ?? file;
}
