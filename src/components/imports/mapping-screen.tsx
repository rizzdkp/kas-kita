"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { applyCsvMappingAction, previewCsvMappingAction } from "@/server/actions/import-upload";
import type { CsvLayout, MappingPreview } from "@/server/import/csv/preview";
import type { CsvMapping } from "@/server/import/types";
import { MappingFields } from "./mapping-fields";
import type { AmountMode } from "./mapping-labels";
import { MappingResult } from "./mapping-result";
import { MappingSampleTable } from "./mapping-sample-table";

type MappingScreenProps = {
  batchId: string;
  accountId: string;
  accountName: string;
  institutionName: string | null;
  /** Templat institusi yang dipakai sebagai titik awal (ada baris yang perlu dicek). */
  templateApplied: boolean;
  /** Batch sudah pernah dipetakan dan sedang di tinjau; menerapkan lagi mengganti barisnya. */
  remapping: boolean;
  initialMapping: CsvMapping;
  initialPreview: MappingPreview;
};

function modeOf(mapping: CsvMapping): AmountMode {
  return mapping.debitColumn !== null || mapping.creditColumn !== null ? "split" : "single";
}

function layoutOf(mapping: CsvMapping): CsvLayout {
  return { encoding: mapping.encoding, delimiter: mapping.delimiter, headerRow: mapping.headerRow };
}

/** Langkah pemetaan kolom CSV (UX-FLOWS 6 langkah 3). */
export function MappingScreen(props: MappingScreenProps) {
  const { batchId, accountId, accountName, institutionName, templateApplied, remapping } = props;
  const router = useRouter();
  const [preview, setPreview] = useState(props.initialPreview);
  const [mapping, setMapping] = useState(props.initialMapping);
  const [amountMode, setAmountMode] = useState<AmountMode>(modeOf(props.initialMapping));
  const [saveTemplate, setSaveTemplate] = useState(institutionName !== null);
  const [error, setError] = useState<string | null>(null);
  const [previewing, startPreview] = useTransition();
  const [submitting, startSubmit] = useTransition();
  // jawaban pratinjau lama diabaikan kalau pengguna sudah mengubah pilihan lagi
  const latest = useRef(0);

  function refresh(layout: CsvLayout, draft: CsvMapping | null) {
    const id = ++latest.current;
    startPreview(async () => {
      const result = await previewCsvMappingAction({ batchId, layout, draft: draft ? { ...draft } : null });
      if (id !== latest.current) return;
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      setPreview(result.data);
      if (!draft) {
        setMapping(result.data.suggestion);
        setAmountMode(modeOf(result.data.suggestion));
      }
    });
  }

  function onMapping(patch: Partial<CsvMapping>) {
    const next = { ...mapping, ...patch };
    setMapping(next);
    refresh(layoutOf(next), next);
  }

  function onAmountMode(mode: AmountMode) {
    setAmountMode(mode);
    onMapping(mode === "split" ? { amountColumn: null } : { debitColumn: null, creditColumn: null });
  }

  function submit() {
    setError(null);
    startSubmit(async () => {
      const result = await applyCsvMappingAction({ batchId, mapping, saveTemplate: saveTemplate && institutionName !== null });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/impor/${batchId}`);
    });
  }

  const ready = preview.result !== null && preview.problem === null && !previewing;
  const target = institutionName ? `${accountName} (${institutionName})` : accountName;

  return (
    <div className="flex flex-col gap-8 pb-32">
      <div className="flex flex-col gap-1">
        <p className="max-w-[70ch] text-body text-primary">
          Petakan kolom mutasi untuk {target}. Pratinjau di bawah berubah mengikuti pilihanmu.
        </p>
        {templateApplied ? (
          <p className="max-w-[70ch] text-small text-secondary">Pemetaan diisi dari templat {institutionName}. Ada baris yang tidak terbaca; cek daftarnya sebelum lanjut.</p>
        ) : null}
        {remapping ? <p className="max-w-[70ch] text-small text-secondary">File ini sudah pernah dipetakan. Menerapkan pemetaan baru mengganti baris di layar tinjau.</p> : null}
        <Link href={`/impor?akun=${accountId}`} className="mt-2 w-fit text-small text-secondary underline underline-offset-4 hover:text-primary">
          Unggah file lain
        </Link>
      </div>

      <MappingSampleTable columns={preview.columns} sample={preview.sample} mapping={mapping} />

      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:items-start lg:gap-12">
        <section aria-labelledby="pemetaan-kolom" className="flex flex-col gap-4">
          <h2 id="pemetaan-kolom" className="text-section text-primary">
            Kolom
          </h2>
          <MappingFields
            mapping={mapping}
            columns={preview.columns}
            topRows={preview.topRows}
            amountMode={amountMode}
            disabled={submitting}
            onMapping={onMapping}
            onAmountMode={onAmountMode}
            onLayout={(patch) => refresh({ ...layoutOf(mapping), ...patch }, null)}
          />
        </section>

        <div className="flex min-w-0 flex-col gap-8">
          <MappingResult result={preview.result} problem={preview.problem} pending={previewing} />

          <div className="flex flex-col items-start gap-3 border-t border-border pt-6">
            {institutionName ? (
              <Checkbox
                checked={saveTemplate}
                onChange={(e) => setSaveTemplate(e.target.checked)}
                disabled={submitting}
                label={`Simpan sebagai templat untuk ${institutionName}`}
                description={`Impor CSV berikutnya dari ${institutionName} langsung memakai pemetaan ini.`}
              />
            ) : (
              <p className="text-small text-secondary">Akun ini tanpa institusi, jadi pemetaan tidak bisa disimpan sebagai templat.</p>
            )}
            {error ? (
              <p role="alert" className="text-small text-error">
                {error}
              </p>
            ) : null}
            <Button variant="primary" onClick={submit} loading={submitting} disabled={!ready || submitting}>
              Lanjut ke tinjau
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
