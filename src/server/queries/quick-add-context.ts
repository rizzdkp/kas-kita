import { and, asc, eq, isNull } from "drizzle-orm";
import type { Scope } from "@/lib/scope";
import { GENERIC_ACCOUNT_WORDS } from "@/lib/quick-add-keywords";
import type {
  Party,
  QuickAddAccountType,
  QuickAddContextAccount,
  QuickAddContextCategory,
  QuickAddContextData,
} from "@/components/quick-add/types";
import { getAiConfig } from "@/server/ai/client";
import type { Viewer } from "@/server/auth/viewer";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { accounts, institutions } from "@/server/db/schema";
import { listCategories } from "./categories";
import { getLastUsedDefaults } from "./transactions";

// akun harian lebih dulu supaya "bca" cocok ke rekening, bukan ke kartu kredit BCA
const TYPE_RANK: Record<QuickAddAccountType, number> = {
  ewallet: 0, bank: 0, cash: 0, credit_card: 1, paylater: 1, loan: 2, investment: 2, other_asset: 2,
};
const EVERYDAY_TYPES = new Set<QuickAddAccountType>(["ewallet", "bank", "cash"]);

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

/** Alias otomatis dari nama institusi: "BCA Rizz" dengan institusi BCA dapat alias "bca". */
export function accountAliases(name: string, institutionName: string | null, institutionSlug: string | null, type: QuickAddAccountType): string[] {
  const out = new Set<string>();
  const nameNorm = norm(name);
  for (const source of [institutionName, institutionSlug?.replace(/-/g, " ") ?? null]) {
    if (!source) continue;
    const phrase = norm(source);
    if (phrase && phrase !== nameNorm) out.add(phrase);
    for (const w of phrase.split(" ")) if (w.length >= 2 && !GENERIC_ACCOUNT_WORDS.has(w)) out.add(w);
  }
  if (type === "credit_card") out.add("cc");
  if (type === "cash") out.add("tunai");
  return [...out];
}

function partyOf(ownerId: string | null, viewer: Viewer): Party {
  if (ownerId === null) return "shared";
  return ownerId === viewer.user.id ? "me" : "partner";
}

async function loadAccounts(viewer: Viewer, db: DbOrTx): Promise<QuickAddContextAccount[]> {
  const rows = await db
    .select({
      id: accounts.id,
      name: accounts.name,
      type: accounts.type,
      ownerId: accounts.ownerId,
      institutionName: institutions.name,
      institutionSlug: institutions.slug,
      sortOrder: accounts.sortOrder,
    })
    .from(accounts)
    .leftJoin(institutions, eq(institutions.id, accounts.institutionId))
    .where(and(isNull(accounts.deletedAt), isNull(accounts.archivedAt)))
    .orderBy(asc(accounts.sortOrder), asc(accounts.name));
  const names = new Map<string, string>([[viewer.user.id, viewer.user.displayName]]);
  if (viewer.partner) names.set(viewer.partner.id, viewer.partner.displayName);
  return rows
    .filter((r) => r.ownerId === null || names.has(r.ownerId))
    .sort((a, b) => TYPE_RANK[a.type] - TYPE_RANK[b.type])
    .map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      owner: partyOf(r.ownerId, viewer),
      ownerName: r.ownerId ? (names.get(r.ownerId) ?? null) : null,
      aliases: accountAliases(r.name, r.institutionName, r.institutionSlug, r.type),
    }));
}

async function loadCategories(db: DbOrTx): Promise<QuickAddContextCategory[]> {
  const tree = await listCategories({}, db);
  const out: QuickAddContextCategory[] = [];
  for (const root of tree) {
    if (root.kind === "system") continue;
    const kind = root.kind as "income" | "expense";
    // induk yang punya anak tetap bisa dipilih, sesuai form transaksi
    out.push({ id: root.id, name: root.name, kind, parentName: null });
    for (const child of root.children) out.push({ id: child.id, name: child.name, kind, parentName: root.name });
  }
  return out;
}

// hanya flag yang keluar dari server; kegagalan dekripsi key dianggap belum terpasang
async function textModelAvailable(db: DbOrTx): Promise<boolean> {
  try {
    return Boolean((await getAiConfig(db))?.textModel);
  } catch {
    return false;
  }
}

function fallbackAccount(list: QuickAddContextAccount[], owners: Party[]): string | null {
  for (const owner of owners) {
    const hit = list.find((a) => a.owner === owner && EVERYDAY_TYPES.has(a.type));
    if (hit) return hit.id;
  }
  return null;
}

/** Konteks parser quick-add: akun aktif dengan alias, kategori, default akun per cakupan, nama partner. */
export async function getQuickAddContext(viewer: Viewer, db: DbOrTx = defaultDb): Promise<QuickAddContextData> {
  const [accountList, categoryList] = await Promise.all([loadAccounts(viewer, db), loadCategories(db)]);
  const valid = (id: string | null) => (id && accountList.some((a) => a.id === id) ? id : null);
  const lastUsed = async (who: Viewer, scope: Scope) => valid((await getLastUsedDefaults(who, scope, db)).accountId);
  // belum pernah mengisi untuk partner: pakai akun yang terakhir dipakai partner sendiri
  const asPartner: Viewer | null = viewer.partner ? { user: viewer.partner, partner: viewer.user, sessionId: viewer.sessionId } : null;
  const [me, partnerByMe, partnerOwn, all, aiAvailable] = await Promise.all([
    lastUsed(viewer, "me"),
    asPartner ? lastUsed(viewer, "partner") : Promise.resolve(null),
    asPartner ? lastUsed(asPartner, "me") : Promise.resolve(null),
    lastUsed(viewer, "all"),
    textModelAvailable(db),
  ]);
  const partner = partnerByMe ?? partnerOwn;
  return {
    accounts: accountList,
    categories: categoryList,
    defaults: {
      me: me ?? fallbackAccount(accountList, ["me"]),
      partner: viewer.partner ? (partner ?? fallbackAccount(accountList, ["partner"])) : null,
      all: all ?? me ?? fallbackAccount(accountList, ["me", "shared"]),
    },
    meName: viewer.user.displayName,
    partnerName: viewer.partner?.displayName ?? null,
    aiAvailable,
  };
}
