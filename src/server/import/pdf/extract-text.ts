// ekstraksi teks PDF per halaman dengan pdfjs-dist (build legacy untuk Node), tanpa render dan tanpa skrip

export const PDF_MAX_BYTES = 20 * 1024 * 1024;
const MAX_PAGES = 200;

export type ExtractResult =
  | { kind: "ok"; pages: string[] }
  | { kind: "needs_password"; wrongPassword: boolean }
  | { kind: "invalid" };

interface TextItemLike {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

type PdfjsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

let pdfjsPromise: Promise<PdfjsModule> | null = null;

// worker dipasang di thread utama supaya pdfjs tidak mengimpor file worker lewat path relatif (rusak saat dibundel Next)
async function loadPdfjs(): Promise<PdfjsModule> {
  pdfjsPromise ??= (async () => {
    const holder = globalThis as { pdfjsWorker?: unknown };
    holder.pdfjsWorker ??= await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
    return import("pdfjs-dist/legacy/build/pdf.mjs");
  })();
  return pdfjsPromise;
}

/** Cek magic bytes "%PDF-" di 1024 byte pertama, sesuai toleransi pembaca PDF umum. */
export function looksLikePdf(bytes: Uint8Array): boolean {
  const head = Buffer.from(bytes.subarray(0, 1024)).toString("latin1");
  return head.includes("%PDF-");
}

/**
 * Susun item teks satu halaman menjadi baris: kelompokkan per y (atas ke bawah) lalu urutkan x.
 * Celah lebar antar item menjadi dua spasi supaya parser bisa memisah kolom dengan /\s{2,}/.
 */
export function itemsToText(items: ReadonlyArray<TextItemLike>): string {
  const cells = items
    .filter((i) => i.str.trim() !== "")
    .map((i) => {
      const size = Math.hypot(i.transform[0] ?? 0, i.transform[1] ?? 0) || i.height || 10;
      return { x: i.transform[4] ?? 0, y: i.transform[5] ?? 0, w: i.width, size, str: i.str };
    })
    .sort((a, b) => b.y - a.y || a.x - b.x);

  const lines: (typeof cells)[] = [];
  for (const cell of cells) {
    const line = lines[lines.length - 1];
    const ref = line?.[0];
    // toleransi setengah tinggi huruf: sel satu baris kadang bergeser sedikit karena baseline font berbeda
    if (line && ref && Math.abs(ref.y - cell.y) <= Math.max(ref.size, cell.size) * 0.5) line.push(cell);
    else lines.push([cell]);
  }

  return lines
    .map((line) => {
      line.sort((a, b) => a.x - b.x);
      let out = "";
      let end: number | null = null;
      for (const c of line) {
        if (end !== null) {
          const gap = c.x - end;
          out += gap > c.size * 0.8 ? "  " : gap > c.size * 0.15 ? " " : "";
        }
        out += c.str;
        end = c.x + c.w;
      }
      return out.trimEnd();
    })
    .join("\n");
}

/**
 * Teks per halaman. Password hanya dipakai di memori untuk membuka dokumen ini; tidak disimpan dan
 * tidak pernah dicatat. PDF rusak atau bukan PDF menghasilkan "invalid".
 */
export async function extractPdfText(bytes: Uint8Array, password?: string): Promise<ExtractResult> {
  const pdfjs = await loadPdfjs();
  // pdfjs mentransfer buffer ke worker; salin supaya byte milik pemanggil tetap utuh untuk hash
  const data = new Uint8Array(bytes);
  const task = pdfjs.getDocument({
    data,
    password,
    disableFontFace: true,
    useSystemFonts: false,
    stopAtErrors: false,
    verbosity: pdfjs.VerbosityLevel.ERRORS,
  });
  try {
    const doc = await task.promise;
    const pages: string[] = [];
    const count = Math.min(doc.numPages, MAX_PAGES);
    for (let n = 1; n <= count; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      pages.push(itemsToText(content.items.flatMap((i) => ("str" in i ? [i] : []))));
      page.cleanup();
    }
    return { kind: "ok", pages };
  } catch (e) {
    if (e instanceof Error && e.name === "PasswordException") {
      const code = (e as Error & { code?: unknown }).code;
      return { kind: "needs_password", wrongPassword: code === pdfjs.PasswordResponses.INCORRECT_PASSWORD };
    }
    return { kind: "invalid" };
  } finally {
    await task.destroy().catch(() => {});
  }
}
