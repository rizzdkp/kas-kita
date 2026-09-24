import type { CategoryNode } from "@/server/queries/categories";

export type Option = { id: string; label: string };

/** Kategori dua tingkat jadi daftar datar; anak ditulis dengan nama induknya supaya tidak tertukar. */
export function flattenCategories(tree: CategoryNode[]): Option[] {
  return tree.flatMap((c) => [
    { id: c.id, label: c.name },
    ...c.children.map((child) => ({ id: child.id, label: `${child.name} (${c.name})` })),
  ]);
}
