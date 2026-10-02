import { PgBoss } from "pg-boss";
import { JOB_PDF_AI, PDF_AI_QUEUE_OPTIONS, PGBOSS_SCHEMA, type PdfAiJobData } from "./names";

// klien pg-boss ringan di app: hanya send; tanpa supervisi dan jadwal (itu tugas worker)
type Holder = { kaskitaBoss?: Promise<PgBoss> };
const holder = globalThis as Holder;

async function startClient(): Promise<PgBoss> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL belum diisi");
  const boss = new PgBoss({
    connectionString: url,
    schema: PGBOSS_SCHEMA,
    application_name: "kaskita-app-queue",
    max: 2,
    supervise: false,
    schedule: false,
  });
  // tanpa listener, error koneksi pg-boss menjatuhkan proses
  boss.on("error", (e: unknown) => {
    console.error(JSON.stringify({ level: "error", msg: "queue_client_error", errorName: e instanceof Error ? e.name : typeof e }));
  });
  await boss.start();
  await boss.createQueue(JOB_PDF_AI, PDF_AI_QUEUE_OPTIONS);
  return boss;
}

function getClient(): Promise<PgBoss> {
  holder.kaskitaBoss ??= startClient().catch((e: unknown) => {
    holder.kaskitaBoss = undefined;
    throw e;
  });
  return holder.kaskitaBoss;
}

export type EnqueuePdfAi = (data: PdfAiJobData) => Promise<void>;

/** Kirim job import.pdf-ai; worker yang menjalankannya. */
export const enqueuePdfAi: EnqueuePdfAi = async (data) => {
  const boss = await getClient();
  const id = await boss.send(JOB_PDF_AI, data);
  if (!id) throw new Error("job tidak terkirim");
};

/** Tutup koneksi klien antrean (tes dan skrip); app biasa membiarkannya hidup. */
export async function stopQueueClient(): Promise<void> {
  const pending = holder.kaskitaBoss;
  holder.kaskitaBoss = undefined;
  if (pending) await (await pending).stop({ graceful: false, close: true });
}

/** Ambil job import.pdf-ai berikutnya tanpa menjalankannya; hanya untuk tes. */
export async function fetchPdfAiJobForTest(): Promise<PdfAiJobData | null> {
  const boss = await getClient();
  const [job] = await boss.fetch<PdfAiJobData>(JOB_PDF_AI);
  return job?.data ?? null;
}
