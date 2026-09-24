"use server";

import { z } from "zod";
import { todayJakarta } from "@/lib/dates";
import { completeStructured, getAiConfig } from "@/server/ai/client";
import { buildReceiptPrompt } from "@/server/ai/prompts/receipt-v1";
import {
  EMPTY_RECEIPT_DRAFT,
  normalizeReceipt,
  RECEIPT_SCHEMA_NAME,
  receiptAiJsonSchema,
  receiptAiSchema,
  type ReceiptDraft,
} from "@/server/ai/schemas/receipt";
import type { AiErrorCode } from "@/server/ai/types";
import { readAttachmentFile } from "@/server/attachments/storage";
import { requireViewer } from "@/server/auth/session";
import { DomainError } from "@/server/errors";
import { parseInput } from "@/server/mutations/_shared";
import { ATTACHMENT_NOT_FOUND, deleteAttachment } from "@/server/mutations/attachments";
import { saveReceiptTransaction, type SaveReceiptInput } from "@/server/mutations/receipts";
import { getAttachment, listTransactionAttachments, listTransactionSplits, type AttachmentMeta, type TransactionSplitView } from "@/server/queries/attachments";
import { listCategories } from "@/server/queries/categories";
import { runAction, toActionError, type ActionResult } from "./result";

export type { ReceiptDraft };

export interface ReceiptReadResult {
  draft: ReceiptDraft;
  /** Pesan siap tampil dari klien AI; field tetap bisa diisi tangan. */
  aiError: { code: AiErrorCode; message: string } | null;
}

/** Baca data tanpa revalidatePath: runAction menyegarkan seluruh halaman, tidak perlu untuk query. */
async function runQuery<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    return toActionError(e);
  }
}

// hanya flag yang keluar dari server; key dan base URL tidak pernah dikirim ke browser
async function visionAvailable(): Promise<boolean> {
  try {
    return Boolean((await getAiConfig())?.visionModel);
  } catch {
    return false;
  }
}

/** Tombol kamera memutuskan: buka kamera atau dialog pengaturan AI (F-IN-3 AC5). */
export async function getReceiptStatusAction(): Promise<{ vision: boolean }> {
  await requireViewer();
  return { vision: await visionAvailable() };
}

async function expenseCategories() {
  const tree = await listCategories({ kind: "expense" });
  return tree.flatMap((root) => [
    { id: root.id, name: root.name, parentName: null },
    ...root.children.map((c) => ({ id: c.id, name: c.name, parentName: root.name })),
  ]);
}

/** Kirim foto ke model vision dan kembalikan draf untuk pratinjau; tidak ada yang disimpan di sini. */
export async function readReceiptAction(attachmentId: string): Promise<ActionResult<ReceiptReadResult>> {
  await requireViewer();
  return runQuery(async () => {
    const id = parseInput(z.uuid(), attachmentId);
    const attachment = await getAttachment(id);
    if (!attachment) throw new DomainError("not_found", ATTACHMENT_NOT_FOUND);
    const config = await getAiConfig().catch(() => null);
    if (!config?.visionModel) {
      return { draft: EMPTY_RECEIPT_DRAFT, aiError: { code: "not_configured", message: "Model vision belum dipasang. Isi field dari foto sendiri, atau pasang model vision di pengaturan AI." } };
    }
    const file = await readAttachmentFile(attachment.storageKey);
    if (!file) throw new DomainError("not_found", ATTACHMENT_NOT_FOUND);

    const categories = await expenseCategories();
    const today = todayJakarta();
    const prompt = buildReceiptPrompt({ categories, today, imageDataUrl: `data:image/jpeg;base64,${file.toString("base64")}` });
    const result = await completeStructured(config, {
      purpose: "receipt",
      kind: "vision",
      system: prompt.system,
      user: prompt.user,
      schemaName: RECEIPT_SCHEMA_NAME,
      schema: receiptAiSchema,
      jsonSchema: receiptAiJsonSchema,
    });
    if (result.ok) return { draft: normalizeReceipt(result.data, categories, today), aiError: null };
    // hasil parsial tetap dipakai kalau bentuknya masih terbaca; sisanya diisi tangan
    const partial = receiptAiSchema.safeParse(result.partial);
    const draft = partial.success ? normalizeReceipt(partial.data, categories, today) : EMPTY_RECEIPT_DRAFT;
    return { draft, aiError: { code: result.error.code, message: result.error.message } };
  });
}

/** Simpan dari pratinjau struk: satu transaksi, dipecah per kategori bila diminta, foto jadi lampiran. */
export async function saveReceiptAction(input: SaveReceiptInput): Promise<ActionResult<{ id: string; version: number }>> {
  const viewer = await requireViewer();
  return runAction(async () => {
    const saved = await saveReceiptTransaction(viewer, input);
    return { id: saved.transaction.id, version: saved.transaction.version };
  });
}

export interface TransactionReceiptExtras {
  attachments: AttachmentMeta[];
  splits: TransactionSplitView[];
}

/** Lampiran dan rincian kategori untuk detail transaksi. */
export async function getTransactionExtrasAction(transactionId: string): Promise<ActionResult<TransactionReceiptExtras>> {
  await requireViewer();
  return runQuery(async () => {
    const id = parseInput(z.uuid(), transactionId);
    const [attachments, splits] = await Promise.all([listTransactionAttachments(id), listTransactionSplits(id)]);
    return { attachments, splits };
  });
}

export async function deleteAttachmentAction(input: { id: string; version: number }): Promise<ActionResult<void>> {
  const viewer = await requireViewer();
  return runAction(async () => {
    await deleteAttachment(viewer, input);
  });
}
