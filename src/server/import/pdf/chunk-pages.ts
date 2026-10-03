// potongan per panggilan: halaman panjang dipecah per baris supaya muat di konteks model kecil
export const MAX_CHARS_PER_CALL = 12_000;

/** Pecah halaman menjadi potongan ≤ MAX_CHARS_PER_CALL tanpa memotong di tengah baris. */
export function chunkPages(pages: string[], maxChars: number = MAX_CHARS_PER_CALL): Array<{ page: number; text: string }> {
  const chunks: Array<{ page: number; text: string }> = [];
  pages.forEach((text, i) => {
    if (text.trim() === "") return;
    let current = "";
    for (const line of text.split("\n")) {
      const piece = line.length > maxChars ? line.slice(0, maxChars) : line;
      if (current && current.length + piece.length + 1 > maxChars) {
        chunks.push({ page: i + 1, text: current });
        current = "";
      }
      current = current ? `${current}\n${piece}` : piece;
    }
    if (current.trim()) chunks.push({ page: i + 1, text: current });
  });
  return chunks;
}
