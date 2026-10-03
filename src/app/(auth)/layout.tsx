import type { ReactNode } from "react";
import { asc } from "drizzle-orm";
import { AmbientField } from "@/components/glass/ambient-field";
import type { IdentityColor } from "@/components/identity/identity-colors";
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
    <main className="relative isolate flex min-h-dvh flex-col items-center justify-center bg-canvas px-4 py-12">
      <AmbientField scope="all" meColor={first} partnerColor={second} />
      <div className="relative z-10 flex w-full max-w-[400px] flex-col items-center gap-6">{children}</div>
    </main>
  );
}
