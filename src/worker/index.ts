import { PgBoss } from "pg-boss";
import { cleanupOrphanAttachments } from "@/server/attachments/cleanup";
import { cleanupImportFiles } from "@/server/import/files";
import {
  JOB_CLEANUP_ATTACHMENTS,
  JOB_CLEANUP_IMPORTS,
  JOB_PDF_AI,
  PDF_AI_QUEUE_OPTIONS,
  PGBOSS_SCHEMA,
} from "@/server/jobs/names";
import { handlePdfAiJob } from "./jobs/pdf-ai";
import { errorName, logEvent } from "./log";

// Worker pg-boss (ARCHITECTURE 1 dan 7): antrean impor AI dan job terjadwal, di database yang sama dengan app.
// Jalankan: pnpm worker (env DATABASE_URL, IMPORTS_DIR, ATTACHMENTS_DIR, APP_ENCRYPTION_KEY).

const TZ = "Asia/Jakarta";
const MAINTENANCE_QUEUE = { retryLimit: 1, expireInSeconds: 10 * 60 } as const;

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL belum diisi");

  const boss = new PgBoss({ connectionString: url, schema: PGBOSS_SCHEMA, application_name: "kaskita-worker" });
  boss.on("error", (e: unknown) => logEvent("error", "pgboss_error", { errorName: errorName(e) }));
  await boss.start();

  await boss.createQueue(JOB_PDF_AI, PDF_AI_QUEUE_OPTIONS);
  await boss.createQueue(JOB_CLEANUP_IMPORTS, MAINTENANCE_QUEUE);
  await boss.createQueue(JOB_CLEANUP_ATTACHMENTS, MAINTENANCE_QUEUE);

  await boss.work<unknown>(JOB_PDF_AI, { batchSize: 1 }, async ([job]) => {
    if (!job) return;
    try {
      await handlePdfAiJob(job.data);
    } catch (e) {
      // pesan error bisa memuat potongan data; yang dicatat hanya jenisnya
      logEvent("error", "job_failed", { job: JOB_PDF_AI, errorName: errorName(e) });
      throw new Error("pdf_ai_failed");
    }
  });

  await boss.work(JOB_CLEANUP_IMPORTS, async () => {
    const removed = await cleanupImportFiles();
    logEvent("info", "job_done", { job: JOB_CLEANUP_IMPORTS, removed });
  });

  await boss.work(JOB_CLEANUP_ATTACHMENTS, async () => {
    const { removed, failed } = await cleanupOrphanAttachments();
    logEvent("info", "job_done", { job: JOB_CLEANUP_ATTACHMENTS, removed, failed });
  });

  // 03:15 dan 03:30 WIB, setelah hapus permanen 03:00 (ARCHITECTURE 7)
  await boss.schedule(JOB_CLEANUP_IMPORTS, "15 3 * * *", null, { tz: TZ });
  await boss.schedule(JOB_CLEANUP_ATTACHMENTS, "30 3 * * *", null, { tz: TZ });

  logEvent("info", "worker_started", { queues: [JOB_PDF_AI, JOB_CLEANUP_IMPORTS, JOB_CLEANUP_ATTACHMENTS].join(",") });

  let stopping = false;
  const stop = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    logEvent("info", "worker_stopping", { signal });
    await boss.stop({ graceful: true, timeout: 30_000 }).catch((e: unknown) => logEvent("error", "worker_stop_failed", { errorName: errorName(e) }));
    process.exit(0);
  };
  process.on("SIGTERM", () => void stop("SIGTERM"));
  process.on("SIGINT", () => void stop("SIGINT"));
}

main().catch((e: unknown) => {
  const code = typeof e === "object" && e !== null && "code" in e ? String((e as { code: unknown }).code) : null;
  logEvent("error", "worker_crashed", { errorName: errorName(e), code });
  process.exit(1);
});
