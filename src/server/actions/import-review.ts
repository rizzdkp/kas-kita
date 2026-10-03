"use server";

import { z } from "zod";
import { requireViewer } from "@/server/auth/session";
import { removeImportFiles } from "@/server/import/pipeline";
import { commitImportBatch, type CommitImportInput, type CommitImportResult } from "@/server/mutations/import-commit";
import { parseInput } from "@/server/mutations/_shared";
import { discardImportBatch } from "@/server/mutations/imports";
import { runAction, type ActionResult } from "./result";

/** "Impor [n] transaksi": simpan lalu hapus file sementara (SECURITY.md). */
export async function commitImportAction(input: CommitImportInput): Promise<ActionResult<CommitImportResult>> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const result = await commitImportBatch(viewer, input);
    await removeImportFiles(result.batchId);
    return result;
  });
}

/** Batalkan impor yang belum disimpan beserta file sementaranya. */
export async function discardImportAction(batchId: string): Promise<ActionResult<{ batchId: string }>> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const id = parseInput(z.uuid(), batchId);
    await discardImportBatch(viewer, id);
    await removeImportFiles(id);
    return { batchId: id };
  });
}
