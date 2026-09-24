import type { Scope } from "@/lib/scope";
import type { CategoryGroup, TransactionFormOptions } from "@/components/transactions/types";
import type { Viewer } from "@/server/auth/viewer";
import { listAccounts } from "./accounts";
import { listCategories, type CategoryNode } from "./categories";
import { getLastUsedDefaults } from "./transactions";

function toGroups(nodes: CategoryNode[]): CategoryGroup[] {
  return nodes.map((n) => ({
    id: n.id,
    name: n.name,
    icon: n.icon,
    children: n.children.map((c) => ({ id: c.id, name: c.name, icon: c.icon })),
  }));
}

/** Pilihan form (akun, kategori, orang, default terakhir); dipakai TransactionFormSheet di halaman mana pun. */
export async function loadTransactionFormOptions(viewer: Viewer, scope: Scope): Promise<TransactionFormOptions> {
  const [accounts, expense, income, last] = await Promise.all([
    listAccounts(viewer, { scope: "all", includeArchived: true }),
    listCategories({ kind: "expense" }),
    listCategories({ kind: "income" }),
    getLastUsedDefaults(viewer, scope),
  ]);
  const person = (u: Viewer["user"]) => ({ id: u.id, name: u.displayName, color: u.identityColor });
  return {
    accounts: accounts.all.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      ownerId: a.ownerId,
      archived: a.archivedAt !== null,
    })),
    categories: { expense: toGroups(expense), income: toGroups(income) },
    people: { me: person(viewer.user), partner: viewer.partner ? person(viewer.partner) : null },
    defaults: last,
  };
}

