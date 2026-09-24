import { z } from "zod";

export const QUICK_ADD_SCHEMA_NAME = "quick_add";

// skema ketat untuk server (semua field wajib, boleh null) supaya cocok dengan mode strict json_schema
const strictLine = z.object({
  line: z.number().int().min(1).max(50).describe("Nomor baris input, mulai dari 1"),
  kind: z.enum(["expense", "income", "transfer"]).nullable(),
  amount: z.union([z.number(), z.string()]).nullable().describe("Rupiah bulat, atau teks seperti 25rb atau 1,5jt"),
  accountName: z.string().nullable(),
  toAccountName: z.string().nullable(),
  categoryName: z.string().nullable(),
  date: z.string().nullable().describe("YYYY-MM-DD, atau kata relatif seperti hari ini atau kemarin"),
  note: z.string().nullable(),
  beneficiary: z.enum(["writer", "partner", "shared"]).nullable(),
});

export const quickAddAiStrictSchema = z.object({ items: z.array(strictLine) });

export const quickAddAiJsonSchema = z.toJSONSchema(quickAddAiStrictSchema) as Record<string, unknown>;

// validasi longgar: field yang tidak dikirim model dianggap kosong, nilai enum asing jadi null
const loose = <T extends z.ZodType>(schema: T) => schema.nullish().catch(null).transform((v) => v ?? null);

const looseLine = z.object({
  line: z.coerce.number().int().min(1),
  kind: loose(z.enum(["expense", "income", "transfer"])),
  amount: loose(z.union([z.number(), z.string().max(40)])),
  accountName: loose(z.string().max(120)),
  toAccountName: loose(z.string().max(120)),
  categoryName: loose(z.string().max(120)),
  date: loose(z.string().max(40)),
  note: loose(z.string().max(500)),
  beneficiary: loose(z.enum(["writer", "partner", "shared"])),
});

export const quickAddAiSchema = z.object({ items: z.array(looseLine).max(50) });

export type QuickAddAiOutput = z.infer<typeof quickAddAiSchema>;
export type QuickAddAiLineOutput = QuickAddAiOutput["items"][number];
