import type { QuickAddKind } from "@/lib/quick-add-parser";

/** Pemilik dari sudut pandang yang login; juga dipakai untuk "Untuk siapa". */
export type Party = "me" | "partner" | "shared";

export type QuickAddAccountType =
  | "bank"
  | "ewallet"
  | "cash"
  | "credit_card"
  | "paylater"
  | "loan"
  | "investment"
  | "other_asset";

export interface QuickAddContextAccount {
  id: string;
  name: string;
  type: QuickAddAccountType;
  owner: Party;
  /** Nama pemilik untuk label "milik Rizz"; null untuk Bersama. */
  ownerName: string | null;
  aliases: string[];
}

export interface QuickAddContextCategory {
  id: string;
  name: string;
  kind: "income" | "expense";
  parentName: string | null;
  keywords?: string[];
}

/** Data yang dimuat layout sekali per render; semua nilai serializable. */
export interface QuickAddContextData {
  accounts: QuickAddContextAccount[];
  categories: QuickAddContextCategory[];
  /** Akun default per cakupan (UX-FLOWS 4). */
  defaults: { me: string | null; partner: string | null; all: string | null };
  meName: string;
  partnerName: string | null;
  /** Model teks AI terpasang (F-IN-2 AC2); key dan base URL tidak pernah dikirim ke klien. */
  aiAvailable?: boolean;
}

/** Satu kartu pratinjau: draf parser yang sudah bisa diedit. */
export interface PreviewItem {
  clientId: string;
  raw: string;
  kind: QuickAddKind | null;
  amount: bigint | null;
  accountId: string | null;
  toAccountId: string | null;
  categoryId: string | null;
  occurredAt: Date;
  note: string | null;
  /** null berarti mengikuti pemilik akun. */
  recipient: Party | null;
  error: string | null;
  /** Field yang diisi AI, bukan parser; ditandai halus di kartu sampai diubah tangan. */
  aiFields?: AiField[];
}

export type AiField = "kind" | "amount" | "account" | "toAccount" | "category" | "date" | "note" | "recipient";

export type PreviewField = "kind" | "amount" | "account" | "toAccount" | "category";
