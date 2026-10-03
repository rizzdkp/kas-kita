import { sql, type SQL } from "drizzle-orm";
import { db as defaultDb, type DbOrTx, type Tx } from "@/server/db/client";
import { inTransaction } from "./_shared";

// sama dengan jendela "Baru dihapus" (F-HIST-2 AC2); setelah ini data tidak bisa dipulihkan
export const PURGE_AFTER_DAYS = 30;

export interface PurgeResult {
  counts: Record<string, number>;
  /** File lampiran yang barisnya sudah dihapus; dihapus dari disk setelah transaksi database selesai. */
  storageKeys: string[];
}

async function run(tx: Tx, query: SQL): Promise<Array<Record<string, unknown>>> {
  return (await tx.execute(query)) as unknown as Array<Record<string, unknown>>;
}

async function count(tx: Tx, query: SQL): Promise<number> {
  return (await run(tx, query)).length;
}

/**
 * Hapus permanen baris yang dihapus lunak lebih dari 30 hari (DATA-MODEL aturan 5).
 * audit_log append-only tidak disentuh, jadi riwayat siapa menghapus apa tetap ada.
 * Akun dan kategori yang masih dirujuk data lain dibiarkan sampai rujukannya ikut terhapus.
 */
export async function purgeDeletedRows(now: Date = new Date(), db: DbOrTx = defaultDb): Promise<PurgeResult> {
  const cutoff = new Date(now.getTime() - PURGE_AFTER_DAYS * 86_400_000).toISOString();
  const old = (table: string) => sql.raw(`${table}.deleted_at is not null and ${table}.deleted_at < `);
  const before = sql`${cutoff}::timestamptz`;

  return inTransaction(db, async (tx) => {
    const counts: Record<string, number> = {};
    const purgeTx = sql`(select id from transactions where ${old("transactions")}${before})`;

    // lampiran ikut transaksinya; lampiran yang dihapus sendiri juga dibersihkan
    const files = await run(
      tx,
      sql`delete from attachments where transaction_id in ${purgeTx} or (${old("attachments")}${before}) returning storage_key`,
    );
    counts.attachments = files.length;
    // rujukan opsional ke transaksi: baris impor dan pembayaran tagihan tetap ada tanpa tautan
    await tx.execute(sql`update import_rows set matched_transaction_id = null where matched_transaction_id in ${purgeTx}`);
    await tx.execute(sql`update bill_payments set transaction_id = null where transaction_id in ${purgeTx}`);
    // split dan tag ikut terhapus lewat on delete cascade
    counts.transactions = await count(tx, sql`delete from transactions where id in ${purgeTx} returning id`);

    counts.goal_contributions = await count(
      tx,
      sql`delete from goal_contributions where (${old("goal_contributions")}${before})
        or goal_id in (select id from goals where ${old("goals")}${before}) returning id`,
    );
    counts.goals = await count(tx, sql`delete from goals where ${old("goals")}${before} returning id`);
    await tx.execute(sql`delete from bill_payments where bill_id in (select id from bills where ${old("bills")}${before})`);
    counts.bills = await count(tx, sql`delete from bills where ${old("bills")}${before} returning id`);
    counts.budgets = await count(tx, sql`delete from budgets where ${old("budgets")}${before} returning id`);
    counts.recurring_rules = await count(tx, sql`delete from recurring_rules where ${old("recurring_rules")}${before} returning id`);
    counts.investment_valuations = await count(
      tx,
      sql`delete from investment_valuations where ${old("investment_valuations")}${before} returning id`,
    );

    counts.categories = await count(
      tx,
      sql`delete from categories c where ${old("c")}${before}
        and not exists (select 1 from transactions t where t.category_id = c.id)
        and not exists (select 1 from transaction_splits s where s.category_id = c.id)
        and not exists (select 1 from budgets b where b.category_id = c.id)
        and not exists (select 1 from bills b where b.category_id = c.id)
        and not exists (select 1 from categories k where k.parent_id = c.id)
        returning id`,
    );
    counts.accounts = await count(
      tx,
      sql`delete from accounts a where ${old("a")}${before}
        and not exists (select 1 from transactions t where t.account_id = a.id or t.to_account_id = a.id)
        and not exists (select 1 from bills b where b.pay_from_account_id = a.id or b.credit_card_account_id = a.id)
        and not exists (select 1 from goals g where g.linked_account_id = a.id)
        and not exists (select 1 from import_batches i where i.account_id = a.id)
        and not exists (select 1 from investment_valuations v where v.account_id = a.id)
        returning id`,
    );

    return { counts, storageKeys: files.map((f) => String(f.storage_key)) };
  });
}
