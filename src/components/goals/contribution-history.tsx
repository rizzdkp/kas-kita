import { SheetContent } from "@/components/ui/sheet";
import { formatDateWithYear } from "@/lib/dates";
import { formatRupiah } from "@/lib/money";
import type { GoalItem } from "./types";

export function ContributionHistorySheet({ goal }: { goal: GoalItem }) {
  return (
    <SheetContent title={`Riwayat setoran ${goal.name}`} description="Setoran terbaru di atas.">
      {goal.contributions.length === 0 ? (
        <p className="text-body text-secondary">Belum ada setoran. Tekan Tambah setoran untuk mencatat yang pertama.</p>
      ) : (
        <table className="w-full text-small">
          <thead>
            <tr className="text-left text-secondary">
              <th scope="col" className="py-2 font-normal">Tanggal</th>
              <th scope="col" className="py-2 font-normal">Diisi oleh</th>
              <th scope="col" className="py-2 text-right font-normal">Nominal</th>
            </tr>
          </thead>
          <tbody>
            {goal.contributions.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="py-3 text-primary">{formatDateWithYear(c.contributedAt)}</td>
                <td className="py-3 text-secondary">{c.createdByName}</td>
                <td className="py-3 text-right text-primary">{formatRupiah(c.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </SheetContent>
  );
}
