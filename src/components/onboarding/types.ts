import type { IdentityColor } from "@/server/db/schema/users";

export type OnboardingStep = "profil" | "akun" | "ai";

export type OnboardingPerson = { name: string; color: IdentityColor };

export type OnboardingProfile = { displayName: string; identityColor: IdentityColor; paydayDay: number };

export type StepProps = {
  /** Lanjut ke langkah berikutnya atau selesai kalau ini langkah terakhir. */
  onNext: () => void;
  onSkip: () => void;
  isLast: boolean;
  finishing: boolean;
};
