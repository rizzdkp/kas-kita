import { accountGroup, inputKey, sumBigint, type AccountBalanceInput, type Metric } from "./types";

export function liquidBalance(accounts: AccountBalanceInput[]): Metric<bigint> {
  const liquid = accounts.filter((a) => accountGroup(a.type) === "liquid");
  const inputs: Record<string, bigint> = {};
  for (const a of liquid) inputs[inputKey(inputs, a.name)] = a.balance;
  return {
    value: sumBigint(liquid.map((a) => a.balance)),
    formula: "Saldo likuid = jumlah saldo akun bank, e-wallet, dan tunai",
    inputs,
  };
}
