import { liabilities } from "./liabilities";
import { liquidBalance } from "./liquid-balance";
import { accountGroup, inputKey, sumBigint, type AccountBalanceInput, type Metric } from "./types";

/** Aset tidak likuid memakai nilai pasar terakhir untuk investasi (F-INV-1). */
export function illiquidAssets(accounts: AccountBalanceInput[]): Metric<bigint> {
  const assets = accounts.filter((a) => accountGroup(a.type) === "asset");
  const inputs: Record<string, bigint> = {};
  for (const a of assets) inputs[inputKey(inputs, a.name)] = a.value;
  return {
    value: sumBigint(assets.map((a) => a.value)),
    formula: "Aset tidak likuid = jumlah nilai akun investasi (nilai pasar terakhir) dan aset lain",
    inputs,
  };
}

export function netWorth(accounts: AccountBalanceInput[]): Metric<bigint> {
  const liquid = liquidBalance(accounts).value;
  const assets = illiquidAssets(accounts).value;
  const debts = liabilities(accounts).value;
  return {
    value: sumBigint([liquid, assets, -debts]),
    formula: "Nilai bersih = saldo likuid + aset tidak likuid − kewajiban",
    inputs: { "Saldo likuid": liquid, "Aset tidak likuid": assets, Kewajiban: debts },
  };
}
