"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeOnboardingAction } from "@/server/actions/settings";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { useToast } from "@/components/ui/toast";
import { AccountStep } from "./account-step";
import { AiStep } from "./ai-step";
import { ProfileStep } from "./profile-step";
import type { OnboardingPerson, OnboardingProfile, OnboardingStep } from "./types";

const STEP_TITLE: Record<OnboardingStep, { title: string; description: string }> = {
  profil: { title: "Profil kamu", description: "Nama, warna yang menandai data milikmu, dan tanggal gajian." },
  akun: { title: "Akun pertama", description: "Mulai dari rekening yang paling sering kamu pakai, dengan saldonya hari ini." },
  ai: { title: "Pengaturan AI", description: "Opsional. Semua fitur pencatatan tetap jalan tanpa AI." },
};

type OnboardingFlowProps = {
  steps: readonly OnboardingStep[];
  profile: OnboardingProfile;
  partner: OnboardingPerson | null;
  existingAccountCount: number;
};

/** Pengenalan UX-FLOWS 11: setiap langkah bisa dilewati; selesai atau lewati semua mengisi onboarded_at. */
export function OnboardingFlow({ steps, profile, partner, existingAccountCount }: OnboardingFlowProps) {
  const [index, setIndex] = useState(0);
  const [finishing, startFinishing] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const step = steps[index] ?? "profil";
  const isLast = index >= steps.length - 1;
  const headingId = `langkah-${step}-judul`;

  function finish() {
    startFinishing(async () => {
      const result = await completeOnboardingAction();
      if (!result.ok) {
        toast.show({ title: result.error });
        return;
      }
      router.replace("/");
    });
  }

  function next() {
    if (isLast) finish();
    else setIndex((i) => i + 1);
  }

  const stepProps = { onNext: next, onSkip: next, isLast, finishing };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3 px-1">
        <div className="flex flex-col gap-1">
          <h2 className="text-section text-primary">Siapkan Kas Kita</h2>
          <p className="text-small text-secondary">Semua bisa diubah lagi di Pengaturan.</p>
        </div>
        {steps.length > 1 ? (
          <Button variant="ghost" onClick={finish} disabled={finishing}>
            Lewati pengenalan
          </Button>
        ) : null}
      </div>

      {steps.length > 1 ? (
        <ol aria-label="Langkah pengenalan" className="grid gap-2 px-1" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
          {steps.map((s, i) => (
            <li key={s} aria-current={i === index ? "step" : undefined} className="flex flex-col gap-2">
              <span aria-hidden className={cn("h-1 rounded-pill", i <= index ? "bg-accent" : "bg-surface-sunken")} />
              <span className={cn("text-small", i === index ? "font-medium text-primary" : "text-secondary")}>
                <span className="sr-only">
                  Langkah {i + 1} dari {steps.length}:{" "}
                </span>
                {STEP_TITLE[s].title}
              </span>
            </li>
          ))}
        </ol>
      ) : null}

      <section aria-labelledby={headingId} className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4 sm:p-(--space-card)">
        <div className="flex flex-col gap-1">
          <h3 id={headingId} className="text-card text-primary">
            {STEP_TITLE[step].title}
          </h3>
          <p className="text-small text-secondary">{STEP_TITLE[step].description}</p>
        </div>
        {step === "profil" ? <ProfileStep key="profil" profile={profile} partner={partner} {...stepProps} /> : null}
        {step === "akun" ? <AccountStep key="akun" partner={partner} existingCount={existingAccountCount} {...stepProps} /> : null}
        {step === "ai" ? <AiStep key="ai" {...stepProps} /> : null}
      </section>
    </div>
  );
}
