import { inputKey, sumBigint, type Metric } from "./types";

export interface CategorySpendRow {
  categoryId: string;
  name: string;
  icon: string;
  parentId: string | null;
  parentName: string | null;
  parentIcon: string | null;
  /** Pemilik akun; null = Bersama. */
  ownerId: string | null;
  amount: bigint;
}

export interface OwnerContribution {
  ownerId: string | null;
  amount: bigint;
}

export interface CategoryTotal {
  categoryId: string;
  name: string;
  icon: string;
  total: bigint;
  /** Segmen per pemilik untuk Gabungan (UX-FLOWS bagian 3). */
  byOwner: OwnerContribution[];
  children: Array<{ categoryId: string; name: string; total: bigint }>;
}

/** Dikelompokkan ke kategori induk, urut dari terbesar. */
export function categoryBreakdown(rows: CategorySpendRow[]): Metric<CategoryTotal[]> {
  const groups = new Map<string, CategoryTotal>();
  for (const r of rows) {
    const topId = r.parentId ?? r.categoryId;
    let g = groups.get(topId);
    if (!g) {
      g = {
        categoryId: topId,
        name: r.parentId ? (r.parentName ?? r.name) : r.name,
        icon: r.parentId ? (r.parentIcon ?? r.icon) : r.icon,
        total: 0n,
        byOwner: [],
        children: [],
      };
      groups.set(topId, g);
    }
    g.total += r.amount;
    const owner = g.byOwner.find((o) => o.ownerId === r.ownerId);
    if (owner) owner.amount += r.amount;
    else g.byOwner.push({ ownerId: r.ownerId, amount: r.amount });
    if (r.parentId) {
      const child = g.children.find((c) => c.categoryId === r.categoryId);
      if (child) child.total += r.amount;
      else g.children.push({ categoryId: r.categoryId, name: r.name, total: r.amount });
    }
  }
  const value = [...groups.values()].sort((a, b) => (b.total > a.total ? 1 : b.total < a.total ? -1 : 0));
  for (const g of value) g.children.sort((a, b) => (b.total > a.total ? 1 : b.total < a.total ? -1 : 0));
  const inputs: Record<string, bigint> = {};
  for (const g of value) inputs[inputKey(inputs, g.name)] = g.total;
  inputs[inputKey(inputs, "Total")] = sumBigint(value.map((g) => g.total));
  return {
    value,
    formula: "Pengeluaran per kategori = jumlah transaksi Pengeluaran periode ini per kategori induk",
    inputs,
  };
}
