import { and, asc, inArray, isNull, sql, type SQL } from "drizzle-orm";
import type { Scope } from "@/lib/scope";
import { percentOf } from "@/lib/money";
import type { Viewer } from "@/server/auth/viewer";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { investmentValuations } from "@/server/db/schema";
import { listAccounts, type AccountWithBalance } from "./accounts";

export interface ValuationRow {
  id: string;
  accountId: string;
  valuedOn: string;
  marketValue: bigint;
  note: string | null;
  version: number;
}

export interface InvestmentSummary {
  account: AccountWithBalance;
  /** Saldo awal + transfer masuk - transfer keluar (F-INV-1 AC1). */
  contributed: bigint;
  marketValue: bigint | null;
  valuedOn: string | null;
  /** Nilai pasar - modal disetor; null kalau belum ada valuasi. */
  returnAmount: bigint | null;
  /** Persen terhadap modal disetor; null kalau belum ada valuasi atau modal nol. */
  returnPercent: number | null;
  /** Riwayat valuasi, tanggal naik. */
  valuations: ValuationRow[];
}

function uuidList(ids: string[]): SQL {
  return sql.join(
    ids.map((id) => sql`${id}::uuid`),
    sql`, `,
  );
}

// saldo awal ikut dihitung sebagai modal karena itu uang yang sudah ditanam sebelum dicatat di app
export async function getContributedCapital(accountIds: string[], db: DbOrTx = defaultDb): Promise<Map<string, bigint>> {
  const result = new Map<string, bigint>();
  if (accountIds.length === 0) return result;
  const countable = sql`t.kind = 'transfer' and t.status = 'confirmed' and t.deleted_at is null
    and (t.occurred_at at time zone 'Asia/Jakarta')::date >= a.opening_date`;
  const rows = (await db.execute(sql`
    select a.id::text as account_id,
      (a.opening_balance
        + coalesce((select sum(t.amount) from transactions t where t.to_account_id = a.id and ${countable}), 0)
        - coalesce((select sum(t.amount) from transactions t where t.account_id = a.id and ${countable}), 0))::bigint as contributed
    from accounts a
    where a.id in (${uuidList(accountIds)})`)) as unknown as Array<{ account_id: string; contributed: bigint }>;
  for (const r of rows) result.set(r.account_id, BigInt(r.contributed));
  return result;
}

export async function listValuations(accountIds: string[], db: DbOrTx = defaultDb): Promise<Map<string, ValuationRow[]>> {
  const result = new Map<string, ValuationRow[]>(accountIds.map((id) => [id, []]));
  if (accountIds.length === 0) return result;
  const rows = await db
    .select({
      id: investmentValuations.id,
      accountId: investmentValuations.accountId,
      valuedOn: investmentValuations.valuedOn,
      marketValue: investmentValuations.marketValue,
      note: investmentValuations.note,
      version: investmentValuations.version,
    })
    .from(investmentValuations)
    .where(and(inArray(investmentValuations.accountId, accountIds), isNull(investmentValuations.deletedAt)))
    .orderBy(asc(investmentValuations.valuedOn), asc(investmentValuations.createdAt));
  for (const r of rows) result.get(r.accountId)?.push(r);
  return result;
}

export function summarizeInvestment(account: AccountWithBalance, contributed: bigint, valuations: ValuationRow[]): InvestmentSummary {
  const latest = valuations.at(-1) ?? null;
  const marketValue = latest?.marketValue ?? null;
  const returnAmount = marketValue === null ? null : marketValue - contributed;
  const returnPercent = returnAmount === null || contributed <= 0n ? null : percentOf(returnAmount, contributed);
  return { account, contributed, marketValue, valuedOn: latest?.valuedOn ?? null, returnAmount, returnPercent, valuations };
}

/** Akun investasi di cakupan (Bersama hanya di Gabungan) beserta modal, nilai pasar, dan imbal hasil. */
export async function listInvestments(viewer: Viewer, scope: Scope, db: DbOrTx = defaultDb): Promise<InvestmentSummary[]> {
  const { asset } = await listAccounts(viewer, { scope }, db);
  const list = asset.filter((a) => a.type === "investment");
  const ids = list.map((a) => a.id);
  const [capital, valuations] = await Promise.all([getContributedCapital(ids, db), listValuations(ids, db)]);
  return list.map((a) => summarizeInvestment(a, capital.get(a.id) ?? 0n, valuations.get(a.id) ?? []));
}
