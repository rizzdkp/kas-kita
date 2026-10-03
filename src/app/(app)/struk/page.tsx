import { parseScope } from "@/lib/scope";
import { ReceiptScreen } from "@/components/receipts/receipt-screen";
import { isUuid } from "@/components/transactions/filter-params";
import { defaultAccountId } from "@/components/transactions/form-values";
import { getReceiptStatusAction } from "@/server/actions/receipts";
import { requireViewer } from "@/server/auth/session";
import { getAttachment } from "@/server/queries/attachments";
import { loadTransactionFormOptions } from "@/server/queries/transaction-form";

type SearchParams = Record<string, string | string[] | undefined>;

/** Foto struk F-IN-3: halaman sendiri supaya pratinjau dua kolom punya ruang dan bisa dimuat ulang. */
export default async function StrukPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const viewer = await requireViewer();
  const params = await searchParams;
  const scope = parseScope(typeof params.scope === "string" ? params.scope : null);
  const lampiran = typeof params.lampiran === "string" && isUuid(params.lampiran) ? params.lampiran : null;
  const [options, status, attachment] = await Promise.all([
    loadTransactionFormOptions(viewer, scope),
    getReceiptStatusAction(),
    lampiran ? getAttachment(lampiran) : Promise.resolve(null),
  ]);
  return (
    <ReceiptScreen
      options={options}
      scope={scope === "me" ? null : scope}
      defaultAccountId={defaultAccountId(options, scope)}
      vision={status.vision}
      initialAttachmentId={attachment?.id ?? null}
      savedTransactionId={attachment?.transactionId ?? null}
    />
  );
}
