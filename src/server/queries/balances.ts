import { sql, type SQL } from "drizzle-orm";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";

/**
 * Saldo dihitung dari opening_balance + arus sejak opening_date (docs/decisions/0004).
 * Saldo awal diperlakukan sebagai delta pada opening_date supaya saldo per tanggal dan grafik harian
 * memakai satu sumber yang sama.
 */
export interface DeltaOptions {
  excludeTransactionId?: string;
}

const WIB_DAY = (col: SQL) => sql`(${col} at time zone 'Asia/Jakarta')::date`;

export function accountDeltasSql(opts: DeltaOptions = {}): SQL {
  const exclude = opts.excludeTransactionId ? sql`and t.id <> ${opts.excludeTransactionId}::uuid` : sql``;
  const day = WIB_DAY(sql`t.occurred_at`);
  return sql`
    select a.id as account_id, a.opening_date as day, a.opening_balance as amount
      from accounts a where a.deleted_at is null
    union all
    select t.account_id, ${day}, case when t.kind = 'income' then t.amount else -t.amount end
      from transactions t join accounts a on a.id = t.account_id
      where t.status = 'confirmed' and t.deleted_at is null and ${day} >= a.opening_date ${exclude}
    union all
    select t.to_account_id, ${day}, t.amount
      from transactions t join accounts a on a.id = t.to_account_id
      where t.kind = 'transfer' and t.status = 'confirmed' and t.deleted_at is null
        and ${day} >= a.opening_date ${exclude}`;
}

function uuidList(ids: string[]): SQL {
  return sql.join(
    ids.map((id) => sql`${id}::uuid`),
    sql`, `,
  );
}

export interface BalanceOptions extends DeltaOptions {
  accountIds?: string[];
  /** Kunci hari WIB inklusif; kosong berarti semua transaksi. */
  asOf?: string;
}

export async function getAccountBalances(opts: BalanceOptions = {}, db: DbOrTx = defaultDb): Promise<Map<string, bigint>> {
  if (opts.accountIds && opts.accountIds.length === 0) return new Map();
  const accountFilter = opts.accountIds ? sql`and d.account_id in (${uuidList(opts.accountIds)})` : sql``;
  const asOf = opts.asOf ? sql`and d.day <= ${opts.asOf}::date` : sql``;
  const rows = (await db.execute(sql`
    select d.account_id::text as account_id, coalesce(sum(d.amount), 0)::bigint as balance
    from (${accountDeltasSql(opts)}) d
    where true ${accountFilter} ${asOf}
    group by d.account_id`)) as unknown as Array<{ account_id: string; balance: bigint }>;
  const result = new Map<string, bigint>();
  for (const id of opts.accountIds ?? []) result.set(id, 0n);
  for (const r of rows) result.set(r.account_id, BigInt(r.balance));
  return result;
}

export async function getAccountBalance(accountId: string, opts: Omit<BalanceOptions, "accountIds"> = {}, db: DbOrTx = defaultDb): Promise<bigint> {
  const map = await getAccountBalances({ ...opts, accountIds: [accountId] }, db);
  return map.get(accountId) ?? 0n;
}

/** Jumlah perubahan saldo per hari WIB untuk sekumpulan akun, rentang inklusif. */
export async function getDailyDeltas(
  opts: { accountIds: string[]; from: string; to: string },
  db: DbOrTx = defaultDb,
): Promise<Array<{ day: string; amount: bigint }>> {
  if (opts.accountIds.length === 0) return [];
  const rows = (await db.execute(sql`
    select d.day::text as day, sum(d.amount)::bigint as amount
    from (${accountDeltasSql()}) d
    where d.account_id in (${uuidList(opts.accountIds)}) and d.day between ${opts.from}::date and ${opts.to}::date
    group by d.day order by d.day`)) as unknown as Array<{ day: string; amount: bigint }>;
  return rows.map((r) => ({ day: r.day, amount: BigInt(r.amount) }));
}
