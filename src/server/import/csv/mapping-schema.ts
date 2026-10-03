import { z } from "zod";
import type { CsvMapping } from "../types";
import { CSV_DATE_FORMATS } from "./dates";

export const MAPPING_MESSAGES = {
  date: "Pilih kolom tanggal",
  description: "Pilih kolom deskripsi",
  amount: "Pilih kolom debit dan kredit, atau satu kolom nominal",
  sameColumn: "Kolom debit dan kredit harus berbeda",
} as const;

const column = z.string().trim().max(200);
const optionalColumn = column.nullish().transform((v) => (v ? v : null));

/** Validasi pemetaan dari form atau dari import_templates.mapping (jsonb, jadi unknown). */
export const csvMappingSchema = z
  .object({
    encoding: z.enum(["utf-8", "windows-1252"]),
    delimiter: z.enum([",", ";", "\t"]),
    headerRow: z.number().int().min(-1).max(200),
    dateColumn: column.min(1, MAPPING_MESSAGES.date),
    dateFormat: z.enum(CSV_DATE_FORMATS as [CsvMapping["dateFormat"], ...CsvMapping["dateFormat"][]]),
    descriptionColumn: column.min(1, MAPPING_MESSAGES.description),
    debitColumn: optionalColumn,
    creditColumn: optionalColumn,
    amountColumn: optionalColumn,
    amountPositiveIsIncome: z.boolean(),
    decimalSeparator: z.enum([",", "."]),
    balanceColumn: optionalColumn,
    timeColumn: optionalColumn,
  })
  .superRefine((m, ctx) => {
    const split = m.debitColumn !== null || m.creditColumn !== null;
    if (m.amountColumn === null && !split) {
      ctx.addIssue({ code: "custom", path: ["amountColumn"], message: MAPPING_MESSAGES.amount });
    }
    if (m.debitColumn !== null && m.debitColumn === m.creditColumn) {
      ctx.addIssue({ code: "custom", path: ["creditColumn"], message: MAPPING_MESSAGES.sameColumn });
    }
  })
  .transform((m): CsvMapping => {
    // satu mode nominal saja supaya templat tidak ambigu
    if (m.amountColumn !== null) return { ...m, debitColumn: null, creditColumn: null };
    return m;
  });

export function readStoredMapping(value: unknown): CsvMapping | null {
  const parsed = csvMappingSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
