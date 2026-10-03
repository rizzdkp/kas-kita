import { beneficiaryToChoice, choiceToBeneficiary, type BeneficiaryChoice } from "@/components/transactions/labels";
import type { People } from "@/components/transactions/types";
import type { CommitImportInput } from "@/server/mutations/import-commit";
import type { ReviewRow } from "@/server/queries/import-review";

export type RowAction = "import" | "link" | "skip";

export interface RowChoice {
  action: RowAction;
  categoryId: string | null;
  who: BeneficiaryChoice;
}

export type Choices = Record<string, RowChoice>;

/** Default F-IN-6 AC3: Baru dicentang, Kemungkinan duplikat tidak, Duplikat pasti tidak ikut. */
export function initialChoices(rows: ReviewRow[], accountOwnerId: string | null, people: People): Choices {
  const who = beneficiaryToChoice("owner", accountOwnerId, people);
  return Object.fromEntries(
    rows
      .filter((r) => r.group !== "exact_duplicate")
      .map((r) => [r.id, { action: r.group === "new" ? "import" : "skip", categoryId: r.suggestedCategoryId, who } satisfies RowChoice]),
  );
}

export interface ChoiceCounts {
  imported: number;
  linked: number;
  skipped: number;
  missingCategory: string[];
}

export function countChoices(rows: ReviewRow[], choices: Choices): ChoiceCounts {
  const counts: ChoiceCounts = { imported: 0, linked: 0, skipped: 0, missingCategory: [] };
  for (const r of rows) {
    const c = choices[r.id];
    if (!c || c.action === "skip") counts.skipped += 1;
    else if (c.action === "link") counts.linked += 1;
    else {
      counts.imported += 1;
      if (!c.categoryId) counts.missingCategory.push(r.id);
    }
  }
  return counts;
}

export function toCommitInput(batchId: string, rows: ReviewRow[], choices: Choices, accountOwnerId: string | null, people: People): CommitImportInput {
  return {
    batchId,
    rows: rows.flatMap((r) => {
      const c = choices[r.id];
      if (!c || c.action === "skip") return [];
      return [{ rowId: r.id, action: c.action, categoryId: c.categoryId, beneficiary: choiceToBeneficiary(c.who, accountOwnerId, people) }];
    }),
  };
}

export function commitButtonLabel(counts: ChoiceCounts): string {
  if (counts.imported === 0 && counts.linked > 0) return `Tautkan ${counts.linked} transaksi`;
  return `Impor ${counts.imported} transaksi`;
}

export function commitToastTitle(result: { created: number; linked: number }): string {
  if (result.created === 0) return `${result.linked} transaksi ditautkan`;
  if (result.linked === 0) return `${result.created} transaksi diimpor`;
  return `${result.created} transaksi diimpor, ${result.linked} ditautkan`;
}

export function missingCategoryMessage(n: number): string {
  return `Pilih kategori untuk ${n} transaksi yang dicentang.`;
}
