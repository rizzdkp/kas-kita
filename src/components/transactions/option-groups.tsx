import { InstitutionBadge } from "@/components/brand/institution-badge";
import { CategoryIcon } from "@/components/categories/category-icon";
import { IdentityDot } from "@/components/identity/identity-dot";
import type { GroupedOption, OptionGroup } from "./grouped-select";
import { ownerDot } from "./labels";
import type { CategoryGroup, FormAccount, People } from "./types";

/** Akun dikelompokkan per pemilik; akun arsip hanya muncul kalau sedang terpilih. */
export function accountOptionGroups(accounts: FormAccount[], people: People, keep: Array<string | null | undefined> = []): OptionGroup[] {
  const visible = accounts.filter((a) => !a.archived || keep.includes(a.id));
  const option = (a: FormAccount): GroupedOption => {
    const dot = ownerDot(people, a.ownerId);
    return {
      value: a.id,
      label: a.archived ? `${a.name} (diarsipkan)` : a.name,
      leading: (
        <InstitutionBadge slug={a.institutionSlug} name={a.institutionName} type={a.type} size="sm">
          <IdentityDot color={dot.color} shared={dot.shared} />
        </InstitutionBadge>
      ),
    };
  };
  const groups: OptionGroup[] = [
    { label: "Milik kamu", options: visible.filter((a) => a.ownerId === people.me.id).map(option) },
    ...(people.partner
      ? [{ label: `Milik ${people.partner.name}`, options: visible.filter((a) => a.ownerId === people.partner?.id).map(option) }]
      : []),
    { label: "Bersama", options: visible.filter((a) => a.ownerId === null).map(option) },
  ];
  return groups.filter((g) => g.options.length > 0);
}

/** Pohon kategori dua tingkat: induk bisa dipilih, anak diberi indentasi. */
export function categoryOptions(groups: CategoryGroup[], kind?: "income" | "expense"): GroupedOption[] {
  return groups.flatMap((g) => [
    { value: g.id, label: g.name, leading: <CategoryIcon icon={g.icon} name={g.name} kind={kind} size="sm" /> },
    ...g.children.map((c) => ({
      value: c.id,
      label: c.name,
      selectedLabel: `${g.name} › ${c.name}`,
      nested: true,
      leading: <CategoryIcon icon={c.icon} name={c.name} parentName={g.name} parentIcon={g.icon} kind={kind} size="sm" />,
    })),
  ]);
}

/** Transfer tidak punya kategori; form tetap butuh daftar, jadi jatuh ke pengeluaran. */
export function categoryKind(kind: string | null | undefined): "income" | "expense" {
  return kind === "income" ? "income" : "expense";
}
