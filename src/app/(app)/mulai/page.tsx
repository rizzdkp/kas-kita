import type { Metadata } from "next";
import { requireViewer } from "@/server/auth/session";
import { countHouseholdAccounts } from "@/server/queries/settings";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import type { OnboardingStep } from "@/components/onboarding/types";

export const metadata: Metadata = { title: "Pengenalan" };

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function MulaiPage({ searchParams }: PageProps) {
  const [viewer, params, accountCount] = await Promise.all([requireViewer(), searchParams, countHouseholdAccounts()]);
  const replay = params.ulang === "1";
  // pengguna kedua melihat akun buatan pengguna pertama, jadi cukup langkah profil (UX-FLOWS 11)
  const steps: OnboardingStep[] = accountCount > 0 && !replay ? ["profil"] : ["profil", "akun", "ai"];
  return (
    <OnboardingFlow
      steps={steps}
      profile={{ displayName: viewer.user.displayName, identityColor: viewer.user.identityColor, paydayDay: viewer.user.paydayDay }}
      partner={viewer.partner ? { name: viewer.partner.displayName, color: viewer.partner.identityColor } : null}
      existingAccountCount={accountCount}
    />
  );
}
