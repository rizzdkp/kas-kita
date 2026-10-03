// nama antrean pg-boss; dipakai app (enqueue) dan worker (work/schedule)
export const JOB_PDF_AI = "import.pdf-ai";
export const JOB_CLEANUP_IMPORTS = "cleanup.import-files";
export const JOB_CLEANUP_ATTACHMENTS = "cleanup.orphan-attachments";

export const PGBOSS_SCHEMA = "pgboss";

/** Payload job import.pdf-ai: teks per halaman yang sudah diekstrak, tanpa file dan tanpa password. */
export interface PdfAiJobData {
  batchId: string;
  pages: string[];
}

// payload berisi teks mutasi, jadi job selesai dihapus cepat; gagal tidak diulang karena batch sudah ditandai gagal
export const PDF_AI_QUEUE_OPTIONS = {
  retryLimit: 0,
  expireInSeconds: 15 * 60,
  retentionSeconds: 24 * 60 * 60,
  deleteAfterSeconds: 60 * 60,
} as const;
