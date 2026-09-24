import type { IdentityColor } from "@/components/identity/identity-colors";
import type { Beneficiary, People, Person, TransactionKind } from "./types";

export const KIND_LABEL: Record<TransactionKind, string> = {
  expense: "Pengeluaran",
  income: "Pemasukan",
  transfer: "Transfer",
};

export const KIND_OPTIONS = [
  { value: "expense", label: "Pengeluaran" },
  { value: "income", label: "Pemasukan" },
  { value: "transfer", label: "Transfer" },
] as const satisfies ReadonlyArray<{ value: TransactionKind; label: string }>;

export function personById(people: People, id: string | null): Person | null {
  if (!id) return null;
  if (people.me.id === id) return people.me;
  if (people.partner?.id === id) return people.partner;
  return null;
}

/** Warna titik pemilik: satu warna, atau dua setengah lingkaran untuk Bersama. */
export function ownerDot(people: People, ownerId: string | null): { color?: IdentityColor; shared?: [IdentityColor, IdentityColor]; label: string } {
  const owner = personById(people, ownerId);
  if (owner) return { color: owner.color, label: `Milik ${owner.id === people.me.id ? "kamu" : owner.name}` };
  const partnerColor = people.partner?.color ?? people.me.color;
  return { shared: [people.me.color, partnerColor], label: "Milik Bersama" };
}

/** Nama pihak untuk "Transfer ke Bersama" / "Transfer ke Nadia". */
export function ownerName(people: People, ownerId: string | null): string {
  const p = personById(people, ownerId);
  if (!p) return "Bersama";
  return p.id === people.me.id ? "kamu" : p.name;
}

export type BeneficiaryChoice = "me" | "partner" | "shared";

/** beneficiary disimpan relatif ke pemilik akun; form menampilkannya relatif ke pengguna. */
export function beneficiaryToChoice(b: Beneficiary, accountOwnerId: string | null, people: People): BeneficiaryChoice {
  if (b === "shared" || accountOwnerId === null) return "shared";
  const ownerIsMe = accountOwnerId === people.me.id;
  if (b === "owner") return ownerIsMe ? "me" : "partner";
  return ownerIsMe ? "partner" : "me";
}

export function choiceToBeneficiary(c: BeneficiaryChoice, accountOwnerId: string | null, people: People): Beneficiary {
  if (c === "shared" || accountOwnerId === null) return accountOwnerId === null ? "owner" : "shared";
  const ownerIsMe = accountOwnerId === people.me.id;
  if (c === "me") return ownerIsMe ? "owner" : "partner_of_owner";
  return ownerIsMe ? "partner_of_owner" : "owner";
}

/** Untuk siapa, dengan nama orang (detail, riwayat, dialog konflik). */
export function beneficiaryLabel(b: Beneficiary, accountOwnerId: string | null, people: People): string {
  const choice = beneficiaryToChoice(b, accountOwnerId, people);
  if (choice === "shared") return "Bersama";
  if (choice === "me") return people.me.name;
  return people.partner?.name ?? "Partner";
}

export const STATUS_LABEL = { confirmed: "Terkonfirmasi", draft: "Perlu dikonfirmasi" } as const;

export const SOURCE_LABEL: Record<string, string> = {
  manual: "Form",
  quick_add: "Quick-add",
  receipt: "Foto struk",
  import_csv: "Impor CSV",
  import_pdf: "Impor PDF",
  recurring: "Transaksi berulang",
  adjustment: "Penyesuaian saldo",
};
