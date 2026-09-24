import Link from "next/link";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClassName } from "@/components/ui/button";

// SEMENTARA (M0): placeholder Ringkasan sampai dashboard dibangun.
export default function RingkasanPage() {
  return (
    <Card>
      <EmptyState
        title="Tambahkan akun pertama"
        action={
          <Link href="/akun" className={buttonClassName("primary")}>
            Tambah akun
          </Link>
        }
      >
        Mulai dari rekening yang paling sering kamu pakai. Saldonya bisa dicocokkan nanti.
      </EmptyState>
    </Card>
  );
}
