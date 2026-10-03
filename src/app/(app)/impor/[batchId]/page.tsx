import { ReviewScreen } from "@/components/imports/review-screen";
import { ReviewCommitted, ReviewEmpty, ReviewFailed, ReviewNotFound, ReviewParsing } from "@/components/imports/review-status";
import { isUuid } from "@/components/transactions/filter-params";
import { requireViewer } from "@/server/auth/session";
import { getImportReview } from "@/server/queries/import-review";
import { loadTransactionFormOptions } from "@/server/queries/transaction-form";

/** Layar tinjau impor (UX-FLOWS 6 langkah 4-6): tiga kelompok F-IN-6, lalu satu commit. */
export default async function ImportReviewPage({ params }: { params: Promise<{ batchId: string }> }) {
  const viewer = await requireViewer();
  const { batchId } = await params;
  if (!isUuid(batchId)) return <ReviewNotFound />;
  const review = await getImportReview(viewer, batchId);
  if (!review) return <ReviewNotFound />;
  const { batch } = review;
  if (batch.status === "parsing") return <ReviewParsing ai={batch.format === "ai_pdf"} />;
  if (batch.status === "failed") return <ReviewFailed message={batch.error} accountId={batch.accountId} />;
  if (batch.status === "committed") return <ReviewCommitted batchId={batch.id} />;
  if (review.rows.length === 0) return <ReviewEmpty accountId={batch.accountId} />;
  const options = await loadTransactionFormOptions(viewer, "all");
  return <ReviewScreen key={batch.id} review={review} options={{ categories: options.categories, people: options.people }} />;
}
