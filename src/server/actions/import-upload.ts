"use server";

import { z } from "zod";
import { todayJakarta } from "@/lib/dates";
import { requireViewer } from "@/server/auth/session";
import { DomainError } from "@/server/errors";
import { buildMappingPreview, type MappingPreview } from "@/server/import/csv/preview";
import { applyCsvMapping, CSV_MESSAGES, loadCsvMappingContext } from "@/server/import/csv/upload";
import { parseInput } from "@/server/mutations/_shared";
import { runAction, toActionError, type ActionResult } from "./result";

const layoutSchema = z.object({
  encoding: z.enum(["utf-8", "windows-1252"]).optional(),
  delimiter: z.enum([",", ";", "\t"]).optional(),
  headerRow: z.number().int().min(-1).max(200).optional(),
});

const previewSchema = z.object({
  batchId: z.uuid(),
  layout: layoutSchema,
  // draf boleh belum lengkap; buildMappingPreview yang memvalidasi dan menjelaskan kekurangannya
  draft: z.record(z.string(), z.unknown()).nullish(),
});

const applySchema = z.object({
  batchId: z.uuid(),
  mapping: z.unknown(),
  saveTemplate: z.boolean(),
});

/** Pratinjau langkah pemetaan untuk layout/pemetaan yang sedang dipilih; tidak menyimpan apa pun. */
export async function previewCsvMappingAction(input: z.input<typeof previewSchema>): Promise<ActionResult<MappingPreview>> {
  const viewer = await requireViewer();
  try {
    const data = parseInput(previewSchema, input);
    const ctx = await loadCsvMappingContext(viewer, data.batchId);
    if (!ctx) throw new DomainError("not_found", CSV_MESSAGES.notMapping);
    return { ok: true, data: buildMappingPreview(ctx.bytes, todayJakarta(), data.layout, data.draft ?? null) };
  } catch (e) {
    return toActionError(e);
  }
}

/** Terapkan pemetaan: parse semua baris, dedupe, opsional simpan templat, lalu batch siap ditinjau. */
export async function applyCsvMappingAction(input: z.input<typeof applySchema>): Promise<ActionResult<{ batchId: string; count: number }>> {
  const viewer = await requireViewer();
  return runAction(async () => {
    const data = parseInput(applySchema, input);
    return applyCsvMapping(viewer, data);
  });
}
