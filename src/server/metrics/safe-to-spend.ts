import { inputKey, sumBigint, type Metric } from "./types";

export interface BillDueItem {
  billId: string;
  name: string;
  dueOn: string;
  amount: bigint;
}

export interface GoalSetAsideItem {
  goalId: string;
  name: string;
  /** Setoran yang masih direncanakan sampai gajian (sudah dikurangi setoran periode ini). */
  amount: bigint;
}

export interface MandatoryBudgetItem {
  budgetId: string;
  name: string;
  remaining: bigint;
}

export interface SafeToSpendInput {
  liquid: bigint;
  nextPayday: string;
  billsDue: BillDueItem[];
  goalSetAsides: GoalSetAsideItem[];
  mandatoryBudgets: MandatoryBudgetItem[];
}

export interface SafeToSpend extends Metric<bigint> {
  components: {
    liquid: bigint;
    billsDue: bigint;
    goalSetAsides: bigint;
    mandatoryRemaining: bigint;
  };
  billsDue: BillDueItem[];
  goalSetAsides: GoalSetAsideItem[];
  mandatoryBudgets: MandatoryBudgetItem[];
}

/** Boleh negatif; UI menampilkan "Kurang Rp [x] sampai gajian". */
export function safeToSpend(input: SafeToSpendInput): SafeToSpend {
  const billsDue = sumBigint(input.billsDue.map((b) => b.amount));
  const goalSetAsides = sumBigint(input.goalSetAsides.map((g) => g.amount));
  const mandatoryRemaining = sumBigint(input.mandatoryBudgets.map((b) => (b.remaining > 0n ? b.remaining : 0n)));
  const inputs: Record<string, bigint | string> = {
    "Saldo likuid": input.liquid,
    "Tagihan sebelum gajian": billsDue,
    "Setoran target sampai gajian": goalSetAsides,
    "Sisa anggaran wajib": mandatoryRemaining,
    "Gajian berikutnya": input.nextPayday,
  };
  for (const b of input.billsDue) inputs[inputKey(inputs, `Tagihan ${b.name} (${b.dueOn})`)] = b.amount;
  for (const g of input.goalSetAsides) inputs[inputKey(inputs, `Target ${g.name}`)] = g.amount;
  for (const m of input.mandatoryBudgets) inputs[inputKey(inputs, `Anggaran wajib ${m.name}`)] = m.remaining;
  return {
    value: input.liquid - billsDue - goalSetAsides - mandatoryRemaining,
    formula:
      "Aman dibelanjakan = saldo likuid - tagihan jatuh tempo sebelum gajian - setoran target yang direncanakan sampai gajian - sisa anggaran wajib bulan ini",
    inputs,
    components: { liquid: input.liquid, billsDue, goalSetAsides, mandatoryRemaining },
    billsDue: input.billsDue,
    goalSetAsides: input.goalSetAsides,
    mandatoryBudgets: input.mandatoryBudgets,
  };
}
