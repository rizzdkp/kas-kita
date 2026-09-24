import type { Metadata } from "next";
import Link from "next/link";
import { findEnrollmentUser } from "@/server/auth/enrollment";
import { getViewer } from "@/server/auth/session";
import { AuthCard } from "../_components/ui";
import { EnrollmentFlow } from "./enrollment-flow";

export const metadata: Metadata = { title: "Daftarkan perangkat", robots: { index: false } };

interface EnrollPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function EnrollPage({ searchParams }: EnrollPageProps) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  const invited = token ? await findEnrollmentUser(token) : null;
  if (invited) {
    return <EnrollmentFlow token={token} displayName={invited.displayName} email={invited.email} initialStep="passkey" />;
  }

  // tautan sudah terpakai oleh passkey barusan: lanjutkan ke langkah cadangan dengan sesi yang ada
  const viewer = await getViewer();
  if (viewer && !viewer.user.twoFactorEnabled) {
    return <EnrollmentFlow token="" displayName={viewer.user.displayName} email={viewer.user.email} initialStep="backup" />;
  }

  // konfirmasi TOTP mengganti cookie sesi sehingga halaman dirender ulang; tampilkan hasil akhirnya
  if (viewer) {
    return (
      <AuthCard title="Perangkat terdaftar" description="Passkey dan password cadangan sudah aktif untuk akunmu.">
        <OpenAppLink href="/" label="Buka Kas Kita" />
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Tautan tidak berlaku"
      description="Tautan pendaftaran sudah dipakai atau kedaluwarsa. Tautan berlaku 30 menit dan hanya sekali pakai. Minta tautan baru lewat perintah user:create --link di server."
    >
      <OpenAppLink href="/login" label="Ke halaman masuk" />
    </AuthCard>
  );
}

function OpenAppLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="text-[15px] font-medium text-[var(--accent)] underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
    >
      {label}
    </Link>
  );
}
