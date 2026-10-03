import type { ReactNode } from "react";
import { asc } from "drizzle-orm";
import { AmbientField } from "@/components/glass/ambient-field";
import type { IdentityColor } from "@/components/identity/identity-colors";
import { HouseholdHero } from "@/components/illustrations";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";

// warna identitas kedua pengguna sudah terlihat di app; di sini hanya mewarnai medan ambien
async function householdColors(): Promise<[IdentityColor, IdentityColor | null]> {
  const rows = await db.select({ color: users.identityColor }).from(users).orderBy(asc(users.createdAt)).limit(2);
  return [rows[0]?.color ?? "violet", rows[1]?.color ?? "ocean"];
}

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const [first, second] = await householdColors();
  return (
    <main className="relative isolate flex min-h-dvh flex-col justify-center bg-canvas lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <AmbientField scope="all" meColor={first} partnerColor={second} />
      {/* kecil: ilustrasi jadi kepala di atas kartu; besar: panel kiri dengan satu kalimat nilai produk */}
      <div className="relative z-10 flex flex-col items-center justify-end gap-8 px-4 pt-6 sm:pt-12 lg:justify-center lg:px-12 lg:py-12">
        <HouseholdHero decorative className="w-[128px] sm:w-[220px] lg:w-full lg:max-w-[400px]" />
        <p className="hidden max-w-[22ch] text-center text-title text-primary lg:block">Uang kalian berdua, dalam satu tempat.</p>
      </div>
      <div className="relative z-10 flex flex-col items-center justify-start px-4 pb-12 pt-6 lg:justify-center lg:py-12">
        <div className="flex w-full max-w-[400px] flex-col items-center gap-6">{children}</div>
      </div>
    </main>
  );
}
