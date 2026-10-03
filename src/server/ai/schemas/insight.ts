import { z } from "zod";

export const INSIGHT_SCHEMA_NAME = "insight";

// skema ketat untuk server; id = jenis fakta, teks = kalimat dengan placeholder {{nama_n}}
const strictSentence = z.object({
  id: z.string().describe("Salin persis id fakta dari daftar"),
  teks: z.string().describe("Satu kalimat Bahasa Indonesia; setiap angka, nama, dan tanggal hanya lewat placeholder {{...}}"),
});

export const insightAiStrictSchema = z.object({ kalimat: z.array(strictSentence) });

export const insightAiJsonSchema = z.toJSONSchema(insightAiStrictSchema) as Record<string, unknown>;

const looseSentence = z.object({
  id: z.string().max(40),
  teks: z.string().max(1000),
});

export const insightAiSchema = z.object({ kalimat: z.array(looseSentence).max(12) });

export type InsightAiOutput = z.infer<typeof insightAiSchema>;
