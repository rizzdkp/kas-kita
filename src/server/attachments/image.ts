import sharp from "sharp";

export type ImageKind = "jpeg" | "png" | "webp" | "heic";

// SECURITY.md: batas unggah struk 10 MB
export const RECEIPT_MAX_BYTES = 10 * 1024 * 1024;
export const RECEIPT_MAX_EDGE = 1600;
const JPEG_QUALITY = 80;
// brand ISO BMFF untuk HEIC/HEIF dari kamera iPhone dan Android
const HEIF_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"]);

/** Galat unggah dengan status HTTP dan pesan siap tampil. */
export class UploadError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "UploadError";
    this.status = status;
  }
}

export const UPLOAD_MESSAGES = {
  tooLarge: "Foto lebih dari 10 MB. Ambil ulang fotonya atau pilih foto yang lebih kecil.",
  notImage: "File ini bukan foto JPEG, PNG, WebP, atau HEIC. Pilih foto struk.",
  unreadable: "Foto ini tidak bisa dibuka. Ambil ulang fotonya lalu coba lagi.",
  empty: "File kosong. Pilih foto struk.",
} as const;

function ascii(buf: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...buf.subarray(start, end));
}

/** Jenis gambar dari magic bytes, bukan dari nama file atau Content-Type kiriman browser. */
export function sniffImage(buf: Uint8Array): ImageKind | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => buf[i] === b)) return "png";
  if (buf.length >= 12 && ascii(buf, 0, 4) === "RIFF" && ascii(buf, 8, 12) === "WEBP") return "webp";
  if (buf.length >= 12 && ascii(buf, 4, 8) === "ftyp" && HEIF_BRANDS.has(ascii(buf, 8, 12))) return "heic";
  return null;
}

/**
 * Decode ulang ke JPEG baru: orientasi EXIF diterapkan ke piksel, lalu semua metadata (EXIF, GPS) dibuang
 * karena sharp tidak menyalin metadata kecuali diminta.
 */
export async function reencodeImage(buf: Buffer): Promise<{ data: Buffer; width: number; height: number }> {
  if (buf.length === 0) throw new UploadError(400, UPLOAD_MESSAGES.empty);
  if (buf.length > RECEIPT_MAX_BYTES) throw new UploadError(413, UPLOAD_MESSAGES.tooLarge);
  if (!sniffImage(buf)) throw new UploadError(415, UPLOAD_MESSAGES.notImage);
  try {
    const { data, info } = await sharp(buf, { failOn: "error", limitInputPixels: 50_000_000 })
      .rotate()
      .resize({ width: RECEIPT_MAX_EDGE, height: RECEIPT_MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
  } catch {
    throw new UploadError(422, UPLOAD_MESSAGES.unreadable);
  }
}
