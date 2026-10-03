import { formatRupiah } from "@/lib/money";

/** Satu baris struk di pratinjau; nominal bisa negatif untuk potongan harga. */
export interface ReceiptLine {
  name: string;
  amount: bigint;
  categoryId: string | null;
}

export interface CategoryGroupTotal {
  categoryId: string | null;
  amount: bigint;
  names: string[];
}

// PRD F-IN-3 AC2: selisih di atas 2% dari total struk ditandai
export const MISMATCH_TOLERANCE_PERCENT = 2n;

export function sumLines(lines: ReadonlyArray<{ amount: bigint }>): bigint {
  return lines.reduce((acc, l) => acc + l.amount, 0n);
}

function abs(v: bigint): bigint {
  return v < 0n ? -v : v;
}

/** True kalau jumlah item menyimpang lebih dari 2% dari total struk. */
export function isReceiptMismatch(itemsTotal: bigint, total: bigint): boolean {
  if (total <= 0n) return itemsTotal !== total;
  return abs(itemsTotal - total) * 100n > total * MISMATCH_TOLERANCE_PERCENT;
}

/** Banner UX-FLOWS 5, atau null kalau cocok atau belum ada item. */
export function mismatchMessage(itemsTotal: bigint, total: bigint | null, itemCount: number): string | null {
  if (total === null || itemCount === 0 || !isReceiptMismatch(itemsTotal, total)) return null;
  return `Jumlah item ${formatRupiah(itemsTotal)}, total struk ${formatRupiah(total)}. Cek item yang terlewat.`;
}

/** Item dengan kategori sama digabung, urut kemunculan pertama; satu kategori jadi satu split. */
export function groupLinesByCategory(lines: ReadonlyArray<ReceiptLine>): CategoryGroupTotal[] {
  const groups = new Map<string | null, CategoryGroupTotal>();
  for (const line of lines) {
    const hit = groups.get(line.categoryId);
    const name = line.name.trim();
    if (hit) {
      hit.amount += line.amount;
      if (name) hit.names.push(name);
    } else {
      groups.set(line.categoryId, { categoryId: line.categoryId, amount: line.amount, names: name ? [name] : [] });
    }
  }
  return [...groups.values()];
}

/** Kategori utama transaksi terpecah: grup terbesar, seri dimenangkan yang muncul lebih dulu. */
export function primaryCategoryId(groups: ReadonlyArray<CategoryGroupTotal>): string | null {
  let best: CategoryGroupTotal | null = null;
  for (const g of groups) if (g.categoryId && (!best || g.amount > best.amount)) best = g;
  return best?.categoryId ?? null;
}

/** Catatan split dari nama item, dipotong supaya muat kolom catatan. */
export function splitNote(names: string[], max = 500): string | null {
  const text = names.join(", ");
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
