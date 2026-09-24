import { absBigint, accountGroup, inputKey, sumBigint, type AccountBalanceInput, type Metric } from "./types";

export function liabilities(accounts: AccountBalanceInput[]): Metric<bigint> {
  const debts = accounts.filter((a) => accountGroup(a.type) === "liability");
  const inputs: Record<string, bigint> = {};
  for (const a of debts) inputs[inputKey(inputs, a.name)] = absBigint(a.balance);
  return {
    value: sumBigint(debts.map((a) => absBigint(a.balance))),
    formula: "Kewajiban = jumlah nilai absolut saldo kartu kredit, PayLater, dan pinjaman",
    inputs,
  };
}
