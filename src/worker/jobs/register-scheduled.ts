import type { PgBoss } from "pg-boss";
import { errorName, logEvent } from "../log";
import { handleBudgetCopyJob, JOB_BUDGET_COPY } from "./budget-copy";
import { handleCreditCardBillsJob, JOB_CREDIT_CARD_BILLS } from "./credit-card-bills";
import { handleDueNotificationsJob, JOB_DUE_NOTIFICATIONS } from "./due-notifications";
import { handlePurgeDeletedJob, JOB_PURGE_DELETED } from "./purge-deleted";
import { handleRecurringDraftsJob, JOB_RECURRING_DRAFTS } from "./recurring";

const TZ = "Asia/Jakarta";
// job harian idempoten: gagal diulang sekali, lalu menunggu jadwal berikutnya
const QUEUE_OPTIONS = { retryLimit: 1, retryDelay: 300, expireInSeconds: 30 * 60 } as const;

type ScheduledJob = { name: string; cron: string; run: () => Promise<object> };

// jadwal WIB dari ARCHITECTURE 7
export const SCHEDULED_JOBS: readonly ScheduledJob[] = [
  { name: JOB_BUDGET_COPY, cron: "5 0 1 * *", run: () => handleBudgetCopyJob() },
  { name: JOB_RECURRING_DRAFTS, cron: "10 0 * * *", run: () => handleRecurringDraftsJob() },
  { name: JOB_CREDIT_CARD_BILLS, cron: "0 1 * * *", run: () => handleCreditCardBillsJob() },
  { name: JOB_PURGE_DELETED, cron: "0 3 * * *", run: () => handlePurgeDeletedJob() },
  { name: JOB_DUE_NOTIFICATIONS, cron: "0 8 * * *", run: () => handleDueNotificationsJob() },
];

function numericFields(result: object): Record<string, number> {
  return Object.fromEntries(Object.entries(result).filter((e): e is [string, number] => typeof e[1] === "number"));
}

/** Daftarkan antrean, worker, dan jadwal cron untuk job terjadwal milik transaksi berulang dan pemeliharaan. */
export async function registerScheduledJobs(boss: PgBoss): Promise<string[]> {
  for (const job of SCHEDULED_JOBS) {
    await boss.createQueue(job.name, QUEUE_OPTIONS);
    await boss.work(job.name, async () => {
      try {
        logEvent("info", "job_done", { job: job.name, ...numericFields(await job.run()) });
      } catch (e) {
        logEvent("error", "job_failed", { job: job.name, errorName: errorName(e) });
        throw new Error(`${job.name} gagal`);
      }
    });
    await boss.schedule(job.name, job.cron, null, { tz: TZ });
  }
  return SCHEDULED_JOBS.map((j) => j.name);
}
