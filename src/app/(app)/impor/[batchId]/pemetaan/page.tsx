import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { todayJakarta } from "@/lib/dates";
import { MappingScreen } from "@/components/imports/mapping-screen";
import { buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { isUuid } from "@/components/transactions/filter-params";
import { requireViewer } from "@/server/auth/session";
import { DomainError } from "@/server/errors";
import { buildMappingPreview } from "@/server/import/csv/preview";
import { fitTemplate, loadCsvMappingContext, type CsvMappingContext } from "@/server/import/csv/upload";
import { getImportTemplateForInstitution } from "@/server/queries/import-templates";

export const metadata: Metadata = { title: "Pemetaan kolom" };

/** Langkah pemetaan kolom CSV (F-IN-4 AC1, AC3); file mentah dibaca ulang dari penyimpanan sementara. */
export default async function PemetaanPage({ params }: { params: Promise<{ batchId: string }> }) {
  const viewer = await requireViewer();
  const { batchId } = await params;
  if (!isUuid(batchId)) notFound();

  let ctx: CsvMappingContext | null;
  try {
    ctx = await loadCsvMappingContext(viewer, batchId);
  } catch (e) {
    if (!(e instanceof DomainError)) throw e;
    return (
      <Card className="max-w-3xl">
        <EmptyState
          title="Pemetaan tidak bisa dibuka"
          action={
            <Link href="/impor" className={buttonClassName("primary")}>
              Unggah file mutasi
            </Link>
          }
        >
          {e.message}
        </EmptyState>
      </Card>
    );
  }
  if (!ctx) notFound();

  const today = todayJakarta();
  const template = ctx.institutionId ? await getImportTemplateForInstitution(ctx.institutionId) : null;
  // templat yang cocok dengan kolom file tetap jadi titik awal walau ada baris yang perlu dicek
  const fitted = template ? fitTemplate(ctx.bytes, template.mapping, today) : null;
  const preview = buildMappingPreview(ctx.bytes, today, fitted ?? undefined, fitted ? { ...fitted } : null);

  return (
    <MappingScreen
      batchId={ctx.batchId}
      accountId={ctx.accountId}
      accountName={ctx.accountName}
      institutionName={ctx.institutionName}
      templateApplied={fitted !== null}
      remapping={ctx.status === "review"}
      initialMapping={fitted ?? preview.suggestion}
      initialPreview={preview}
    />
  );
}
