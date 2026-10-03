import type { transactions } from "@/server/db/schema";
import { addDaysKey } from "@/server/metrics/_time";
import type { SeededRandom } from "./random";

export type NewTransaction = typeof transactions.$inferInsert;

export interface SeedAccount {
  id: string;
  ownerId: string | null;
  type: "bank" | "ewallet" | "cash" | "credit_card" | "investment";
  openingBalance: bigint;
}

export interface SeedContext {
  rizzId: string;
  nadiaId: string;
  acc: Record<
    "bcaRizz" | "gopayRizz" | "cashRizz" | "cardRizz" | "reksaRizz" | "jagoNadia" | "ovoNadia" | "cashNadia" | "shared" | "emergency",
    SeedAccount
  >;
  /** "expense:Nama" atau "income:Nama" -> id. */
  cat: (key: string) => string;
}

export interface BillPaymentRef {
  bill: "listrik" | "internet" | "sewa" | "kartu";
  periodStart: string;
  index: number;
}

export interface Generated {
  rows: NewTransaction[];
  billPayments: BillPaymentRef[];
}

function daysInMonth(key: string): number {
  const [y, m] = key.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Simulasi harian dengan saldo berjalan; transaksi yang membuat Tunai atau bank negatif dilewati. */
export function generateTransactions(rng: SeededRandom, ctx: SeedContext, from: string, today: string, now: Date): Generated {
  const { acc, cat, rizzId, nadiaId } = ctx;
  const balances = new Map<string, bigint>(Object.values(acc).map((a) => [a.id, a.openingBalance]));
  const typeOf = new Map(Object.values(acc).map((a) => [a.id, a.type]));
  const rows: NewTransaction[] = [];
  const billPayments: BillPaymentRef[] = [];
  let cardStatementOwed = 0n;

  const at = (day: string, h: number, m = rng.int(0, 59)) =>
    new Date(`${day}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+07:00`);

  function push(tx: Omit<NewTransaction, "updatedBy" | "status" | "source"> & Partial<Pick<NewTransaction, "status" | "source">>): number {
    if (tx.occurredAt > now) return -1;
    const amount = tx.amount;
    const from = tx.accountId;
    const fromType = typeOf.get(from);
    const outflow = tx.kind !== "income";
    if (outflow && (fromType === "cash" || fromType === "bank" || fromType === "ewallet") && (balances.get(from) ?? 0n) < amount) return -1;
    if (tx.status !== "draft") {
      balances.set(from, (balances.get(from) ?? 0n) + (outflow ? -amount : amount));
      if (tx.kind === "transfer" && tx.toAccountId) balances.set(tx.toAccountId, (balances.get(tx.toAccountId) ?? 0n) + amount);
    }
    rows.push({ status: "confirmed", source: "manual", ...tx, updatedBy: tx.createdBy });
    return rows.length - 1;
  }

  const expense = (day: string, h: number, accountId: string, category: string, min: number, max: number, createdBy: string, note?: string, step = 500) =>
    push({ kind: "expense", amount: rng.amount(min, max, step), accountId, categoryId: cat(`expense:${category}`), occurredAt: at(day, h), createdBy, note });
  const transfer = (day: string, h: number, fromId: string, toId: string, amount: bigint, createdBy: string, note?: string) =>
    push({ kind: "transfer", amount, accountId: fromId, toAccountId: toId, occurredAt: at(day, h), createdBy, note });

  for (let day = from; day <= today; day = addDaysKey(day, 1)) {
    const d = Number(day.slice(8, 10));
    const last = daysInMonth(day);
    const weekday = new Date(`${day}T12:00:00+07:00`).getUTCDay();
    const rizzPayday = d === Math.min(25, last);

    // gaji dan pembagian ke Bersama
    if (rizzPayday) {
      push({ kind: "income", amount: 12_500_000n, accountId: acc.bcaRizz.id, categoryId: cat("income:Gaji"), occurredAt: at(day, 8, 5), createdBy: rizzId, source: "recurring" });
      transfer(day, 9, acc.bcaRizz.id, acc.shared.id, 4_000_000n, rizzId, "Setoran bulanan Bersama");
    }
    if (d === 1) {
      push({ kind: "income", amount: 9_000_000n, accountId: acc.jagoNadia.id, categoryId: cat("income:Gaji"), occurredAt: at(day, 7, 30), createdBy: nadiaId, source: "recurring" });
      transfer(day, 8, acc.jagoNadia.id, acc.shared.id, 3_000_000n, nadiaId, "Setoran bulanan Bersama");
      const i = expense(day, 10, acc.shared.id, "Sewa atau cicilan", 3_500_000, 3_500_000, nadiaId, "Sewa rumah");
      if (i >= 0) billPayments.push({ bill: "sewa", periodStart: day, index: i });
    }
    if (d === 3) expense(day, 19, acc.jagoNadia.id, "Keluarga", 1_000_000, 1_000_000, nadiaId, "Kiriman untuk ibu");
    if (d === 2) transfer(day, 9, acc.jagoNadia.id, acc.emergency.id, 750_000n, nadiaId, "Dana darurat");
    if (d === Math.min(26, last)) transfer(day, 9, acc.bcaRizz.id, acc.emergency.id, 1_000_000n, rizzId, "Dana darurat");
    if (d === Math.min(27, last)) transfer(day, 10, acc.bcaRizz.id, acc.reksaRizz.id, 1_000_000n, rizzId, "Investasi rutin");

    // isi ulang e-wallet dan tarik tunai
    if (d === 1 || d === 15) {
      transfer(day, 7, acc.bcaRizz.id, acc.gopayRizz.id, 500_000n, rizzId, "Isi GoPay");
      transfer(day, 7, acc.jagoNadia.id, acc.ovoNadia.id, 400_000n, nadiaId, "Isi OVO");
    }
    if (d === 5 || d === 20) transfer(day, 12, acc.bcaRizz.id, acc.cashRizz.id, 300_000n, rizzId, "Tarik tunai");
    if (d === 10) transfer(day, 12, acc.jagoNadia.id, acc.cashNadia.id, 300_000n, nadiaId, "Tarik tunai");

    // tagihan rumah dari rekening Bersama
    if (d === 10) {
      const i = expense(day, 20, acc.shared.id, "Internet", 385_000, 385_000, rizzId, "IndiHome");
      if (i >= 0) billPayments.push({ bill: "internet", periodStart: day, index: i });
    }
    if (d === 20) {
      const i = expense(day, 19, acc.shared.id, "Listrik", 420_000, 680_000, nadiaId, "Token dan tagihan PLN", 1_000);
      if (i >= 0) billPayments.push({ bill: "listrik", periodStart: day, index: i });
    }
    if (d === 22) expense(day, 9, acc.shared.id, "Air", 90_000, 160_000, rizzId, "PDAM", 1_000);

    // kartu kredit: saldo saat cetak tanggal 5 dilunasi tanggal 20
    if (d === 5) cardStatementOwed = -(balances.get(acc.cardRizz.id) ?? 0n);
    if (d === 20 && cardStatementOwed > 0n) {
      const i = transfer(day, 21, acc.bcaRizz.id, acc.cardRizz.id, cardStatementOwed, rizzId, "Bayar kartu kredit");
      if (i >= 0) billPayments.push({ bill: "kartu", periodStart: day, index: i });
      cardStatementOwed = 0n;
    }

    // belanja harian
    if (rng.chance(0.6)) expense(day, rng.int(9, 16), acc.gopayRizz.id, "Kopi dan jajan", 18_000, 45_000, rizzId, rng.pick(["Kopi Kenangan", "Janji Jiwa", "Fore", "Roti bakar"]));
    if (rng.chance(0.4)) expense(day, rng.int(10, 17), acc.ovoNadia.id, "Kopi dan jajan", 15_000, 40_000, nadiaId, rng.pick(["Chatime", "Kopi Tuku", "Martabak"]));
    if (rng.chance(0.5)) {
      const i = expense(day, 12, rng.pick([acc.gopayRizz.id, acc.cardRizz.id, acc.cashRizz.id]), "Makan di luar", 25_000, 85_000, rizzId, rng.pick(["Makan siang", "Warteg", "Nasi padang", "Bakmi"]));
      const row = rows[i];
      if (row && weekday >= 1 && weekday <= 5 && rng.chance(0.4)) row.note = `${row.note} kantor`;
    }
    if (rng.chance(0.45)) expense(day, 13, rng.pick([acc.ovoNadia.id, acc.cashNadia.id]), "Makan di luar", 20_000, 75_000, nadiaId, rng.pick(["Makan siang", "Soto", "Gado-gado"]));
    if (rng.chance(0.35)) expense(day, rng.int(7, 9), acc.gopayRizz.id, "Ojek dan taksi", 15_000, 45_000, rizzId, "GoRide");
    if (rng.chance(0.3)) expense(day, rng.int(7, 9), acc.ovoNadia.id, "Ojek dan taksi", 12_000, 40_000, nadiaId, "Grab");
    if (rng.chance(0.15)) expense(day, 18, acc.cashRizz.id, "Parkir dan tol", 5_000, 15_000, rizzId, "Parkir", 1_000);
    if (weekday === 6) expense(day, 10, acc.shared.id, "Belanja dapur", 350_000, 750_000, rng.chance(0.5) ? rizzId : nadiaId, rng.pick(["Superindo", "Hypermart", "Pasar"]), 1_000);
    if (weekday === 3 && rng.chance(0.7)) expense(day, 7, acc.cashNadia.id, "Belanja dapur", 30_000, 100_000, nadiaId, "Pasar pagi", 1_000);
    if (weekday === 0) expense(day, 16, acc.cardRizz.id, "Bensin", 150_000, 250_000, rizzId, "Pertamina", 1_000);
    if (rng.chance(0.07)) expense(day, 20, acc.cardRizz.id, "Belanja pribadi", 100_000, 600_000, rizzId, rng.pick(["Tokopedia", "Uniqlo", "Shopee"]), 1_000);
    if (rng.chance(0.06)) expense(day, 20, acc.jagoNadia.id, "Belanja pribadi", 80_000, 500_000, nadiaId, rng.pick(["Sociolla", "Zara", "Shopee"]), 1_000);
    if (rng.chance(0.06)) expense(day, 19, rng.pick([acc.cardRizz.id, acc.jagoNadia.id]), "Hiburan", 50_000, 300_000, rng.chance(0.5) ? rizzId : nadiaId, rng.pick(["Bioskop", "Karaoke", "Konser"]), 1_000);
    if (rng.chance(0.03)) expense(day, 11, acc.jagoNadia.id, "Kesehatan", 50_000, 350_000, nadiaId, rng.pick(["Apotek", "Klinik"]), 1_000);
    if (d === 8) expense(day, 3, acc.cardRizz.id, "Tagihan dan langganan", 186_000, 186_000, rizzId, "Netflix");
    if (d === 12) expense(day, 3, acc.jagoNadia.id, "Tagihan dan langganan", 54_990, 54_990, nadiaId, "Spotify", 10);
    if (d === 28) expense(day, 2, acc.bcaRizz.id, "Biaya bank dan admin", 10_000, 10_000, rizzId, "Biaya admin");
    if (d === last) push({ kind: "income", amount: rng.amount(8_000, 20_000, 1), accountId: acc.jagoNadia.id, categoryId: cat("income:Bunga dan imbal hasil"), occurredAt: at(day, 23, 50), createdBy: nadiaId });
    if (rng.chance(0.02)) push({ kind: "income", amount: rng.amount(500_000, 1_500_000, 50_000), accountId: acc.jagoNadia.id, categoryId: cat("income:Usaha sampingan"), occurredAt: at(day, 15), createdBy: nadiaId, note: "Pesanan kue" });
    // sesekali Rizz mencatat atas nama Nadia ("diisi oleh")
    if (rng.chance(0.04)) expense(day, 21, acc.cashNadia.id, "Makan di luar", 20_000, 60_000, rizzId, "Martabak titipan");
  }
  return { rows, billPayments };
}
