import { z } from "zod";

// prompt tes koneksi F-AI-1 AC2: jawaban apa pun yang lolos skema berarti model merespons dengan JSON
export const TEST_CONNECTION_SCHEMA_NAME = "test_connection";

export const testConnectionSchema = z.object({ reply: z.string() });
export type TestConnectionOutput = z.infer<typeof testConnectionSchema>;
export const testConnectionJsonSchema = z.toJSONSchema(testConnectionSchema) as Record<string, unknown>;

export const TEST_CONNECTION_SYSTEM = "Kamu dipakai untuk memeriksa koneksi. Jawab singkat dalam JSON dengan field reply.";
export const TEST_CONNECTION_TEXT_PROMPT = 'Balas dengan {"reply": "ok"}.';
export const TEST_CONNECTION_VISION_PROMPT = "Sebutkan warna utama gambar ini dalam satu kata di field reply.";
