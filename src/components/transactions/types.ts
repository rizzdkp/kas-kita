import type { IdentityColor } from "@/components/identity/identity-colors";
import type { AccountType, Beneficiary, TransactionKind } from "@/server/db/schema";

export type { Beneficiary, TransactionKind };

export interface Person {
  id: string;
  name: string;
  color: IdentityColor;
}

export interface People {
  me: Person;
  partner: Person | null;
}

export interface FormAccount {
  id: string;
  name: string;
  type: AccountType;
  /** null = Bersama. */
  ownerId: string | null;
  archived: boolean;
}

export interface CategoryLeaf {
  id: string;
  name: string;
  icon: string;
}

export interface CategoryGroup extends CategoryLeaf {
  children: CategoryLeaf[];
}

export interface TransactionFormOptions {
  accounts: FormAccount[];
  categories: { expense: CategoryGroup[]; income: CategoryGroup[] };
  people: People;
  /** Akun dan kategori terakhir untuk cakupan yang diminta (F-IN-1 AC2). */
  defaults: { accountId: string | null; categoryId: string | null };
}

/** Nilai awal form; untuk mode edit id dan version wajib. */
export interface TransactionFormInitial {
  id?: string;
  version?: number;
  kind?: TransactionKind;
  amount?: bigint;
  accountId?: string;
  toAccountId?: string | null;
  categoryId?: string | null;
  occurredAt?: Date;
  note?: string | null;
  beneficiary?: Beneficiary;
  status?: "confirmed" | "draft";
  tagNames?: string[];
}
