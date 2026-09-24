import { SheetContent } from "@/components/ui/sheet";
import { formatDateWithYear } from "@/lib/dates";
import { formatRupiah } from "@/lib/money";
import type { BillItem } from "./types";

export function BillHistorySheet({ bill }: { bill: BillItem }) {
  return (
    <SheetContent title={`Riwayat ${bill.name}`} description="Pembayaran terbaru di atas.">
      {bill.history.length === 0 ? (
        <p className="text-body text-secondary">Belum ada pembayaran untuk tagihan ini. Tekan Bayar saat tagihan sudah dilunasi.</p>
      ) : (
        <table className="w-full text-small">
          <thead>
            <tr className="text-left text-secondary">
              <th scope="col" className="py-2 font-normal">Dibayar</th>
              <th scope="col" className="py-2 font-normal">Akun</th>
              <th scope="col" className="py-2 text-right font-normal">Nominal</th>
            </tr>
          </thead>
          <tbody>
            {bill.history.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="py-3 text-primary">{formatDateWithYear(p.paidAt)}</td>
                <td className="py-3 text-secondary">{p.accountName ?? "Transaksi dihapus"}</td>
                <td className="py-3 text-right text-primary">{p.amount === null ? "" : formatRupiah(p.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </SheetContent>
  );
}
