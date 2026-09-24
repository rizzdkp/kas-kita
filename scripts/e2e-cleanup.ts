import { sql } from "@/server/db/client";

// hanya untuk tes e2e: soft delete data berawalan "E2E " yang ditinggalkan tes (termasuk tes yang gagal di tengah)
if (process.env.NODE_ENV === "production") throw new Error("e2e-cleanup tidak boleh dipakai di produksi");

// argumen: waktu mulai run (ISO); data run lain yang sedang berjalan tidak disentuh kecuali sudah basi
const since = process.argv[2] ? new Date(process.argv[2]) : new Date(0);

const result = await sql.begin(async (tx) => {
  const window = tx`(created_at >= ${since.toISOString()}::timestamptz or created_at < now() - interval '30 minutes')`;
  const accounts = await tx`
    update accounts set deleted_at = now(), version = version + 1, updated_at = now()
    where deleted_at is null and name like 'E2E %' and ${window}
    returning id`;
  const accountIds = accounts.map((a) => a.id as string);
  const transactions = await tx`
    update transactions set deleted_at = now(), version = version + 1, updated_at = now()
    where deleted_at is null and ${window}
      and (note like 'E2E %' ${accountIds.length ? tx`or account_id in ${tx(accountIds)} or to_account_id in ${tx(accountIds)}` : tx``})
    returning id`;
  const bills = await tx`
    update bills set deleted_at = now(), version = version + 1, updated_at = now()
    where deleted_at is null and name like 'E2E %' and ${window} returning id`;
  const goals = await tx`
    update goals set deleted_at = now(), version = version + 1, updated_at = now()
    where deleted_at is null and name like 'E2E %' and ${window} returning id`;
  return { accounts: accounts.length, transactions: transactions.length, bills: bills.length, goals: goals.length };
});

console.log(JSON.stringify(result));
await sql.end();
