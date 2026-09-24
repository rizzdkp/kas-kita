import { formatTime } from "@/lib/dates";

// pesan error domain selalu siap tampil ke pengguna (COPY.md bagian 4)
export class DomainError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "DomainError";
    this.code = code;
  }
}

export class ValidationError extends DomainError {
  readonly fieldErrors: Record<string, string[]>;
  constructor(message: string, fieldErrors: Record<string, string[]> = {}) {
    super("validation", message);
    this.name = "ValidationError";
    this.fieldErrors = fieldErrors;
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string, id: string) {
    super("not_found", `Data ${entity} ${id} tidak ditemukan. Muat ulang halaman lalu coba lagi.`);
    this.name = "NotFoundError";
  }
}

const ENTITY_SUBJECT: Record<string, string> = {
  transactions: "Transaksi ini",
  accounts: "Akun ini",
  categories: "Kategori ini",
  budgets: "Anggaran ini",
  bills: "Tagihan ini",
  goals: "Target ini",
  goal_contributions: "Setoran ini",
  investment_valuations: "Nilai ini",
};

export interface ConflictInfo<Row> {
  entity: string;
  latest: Row;
  updatedByName: string | null;
  updatedAt: Date;
}

/** Update dengan versi lama; membawa baris terbaru supaya UI bisa menampilkan kedua versi (F-HIST-3). */
export class ConflictError<Row = unknown> extends DomainError {
  readonly entity: string;
  readonly latest: Row;
  readonly updatedByName: string | null;
  readonly updatedAt: Date;
  constructor(info: ConflictInfo<Row>) {
    const subject = ENTITY_SUBJECT[info.entity] ?? "Data ini";
    const who = info.updatedByName ?? "orang lain";
    super("conflict", `${subject} baru diubah ${who} pukul ${formatTime(info.updatedAt)}. Pilih versi yang dipakai.`);
    this.name = "ConflictError";
    this.entity = info.entity;
    this.latest = info.latest;
    this.updatedByName = info.updatedByName;
    this.updatedAt = info.updatedAt;
  }
}

/** Saldo akun (Tunai, atau bank tanpa overdraft) akan jadi negatif. */
export class InsufficientBalanceError extends DomainError {
  readonly accountId: string;
  readonly available: bigint;
  constructor(accountId: string, message: string, available: bigint) {
    super("insufficient_balance", message);
    this.name = "InsufficientBalanceError";
    this.accountId = accountId;
    this.available = available;
  }
}

export function isDomainError(e: unknown): e is DomainError {
  return e instanceof DomainError;
}
