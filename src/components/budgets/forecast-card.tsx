import { Card, CardTitle } from "@/components/ui/card";
import { formatRupiah } from "@/lib/money";
import type { Forecast } from "@/server/metrics/forecast";
import type { Metric } from "@/server/metrics/types";
import { FormulaPanel } from "./formula-panel";

/** Prediksi akhir bulan sebagai rentang (F-BUD-2 AC1), atau penjelasan kapan tersedia (AC2). */
export function ForecastCard({ forecast, monthEndLabel }: { forecast: Metric<Forecast>; monthEndLabel: string }) {
  const v = forecast.value;
  if (!v.available) {
    return (
      <Card as="section" aria-labelledby="prediksi-judul" className="flex flex-col gap-2">
        <CardTitle id="prediksi-judul">Prediksi muncul setelah {v.requiredDays} hari data</CardTitle>
        <p className="text-body text-secondary">Saat ini ada data {v.dataDays} hari.</p>
      </Card>
    );
  }
  return (
    <Card as="section" aria-labelledby="prediksi-judul" className="flex flex-col gap-2">
      <CardTitle id="prediksi-judul">Prediksi pengeluaran sampai {monthEndLabel}</CardTitle>
      <p className="tabular text-section text-primary">
        <span className="whitespace-nowrap">{formatRupiah(v.low)}</span>
        <span className="text-secondary"> sampai </span>
        <span className="whitespace-nowrap">{formatRupiah(v.high)}</span>
      </p>
      <p className="text-small text-secondary">
        Sudah terpakai <span className="tabular">{formatRupiah(v.spentSoFar)}</span>
        {v.billsRemaining > 0n ? (
          <>
            , ditambah tagihan <span className="tabular">{formatRupiah(v.billsRemaining)}</span> yang belum dibayar
          </>
        ) : null}
        {v.remainingDays > 0 ? (
          <>
            {" "}
            dan {v.remainingDays} hari pengeluaran fleksibel.
          </>
        ) : (
          "."
        )}
      </p>
      <FormulaPanel formula={forecast.formula} inputs={forecast.inputs} />
    </Card>
  );
}
