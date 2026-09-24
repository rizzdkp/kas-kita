"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

export const ONBOARDING_PATH = "/mulai";

/**
 * Pasang di AppFrame dengan `pending={needsOnboarding(viewer)}` dari layout server.
 * Layout tidak tahu path aktif, jadi pengalihan dilakukan di klien dan dikecualikan untuk /mulai sendiri.
 */
export function OnboardingRedirect({ pending }: { pending: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (pending && pathname !== ONBOARDING_PATH) router.replace(ONBOARDING_PATH);
  }, [pending, pathname, router]);
  return null;
}
