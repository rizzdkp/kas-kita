import { z } from "zod";
import { runPdfAiJob, type PdfAiJobOutcome } from "@/server/import/pdf/ai-extract";

const payloadSchema = z.object({ batchId: z.uuid(), pages: z.array(z.string().max(200_000)).max(200) });

/** Payload dari antrean divalidasi dulu; job rusak dilewati tanpa mencatat isinya. */
export async function handlePdfAiJob(data: unknown): Promise<PdfAiJobOutcome> {
  const parsed = payloadSchema.safeParse(data);
  if (!parsed.success) return "skipped";
  return runPdfAiJob(parsed.data);
}
