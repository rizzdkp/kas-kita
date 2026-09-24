"use client";

import { useState } from "react";
import type { Scope } from "@/lib/scope";
import { AmbientField } from "@/components/glass/ambient-field";
import { ScopeToggle } from "@/components/glass/scope-toggle";
import { ToastProvider } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ButtonsSection } from "./buttons-section";
import { ContentSection } from "./content-section";
import { FormsSection } from "./forms-section";
import { FoundationSection } from "./foundation-section";
import { GlassSection } from "./glass-section";
import { OverlaySection } from "./overlay-section";
import { PreferencesBar } from "./preferences-bar";

export const CONTOH = {
  me: { name: "Contoh Saya", color: "ocean" },
  partner: { name: "Contoh Partner", color: "rose" },
} as const;

export function Gallery() {
  const [scope, setScope] = useState<Scope>("me");
  return (
    <TooltipProvider delayDuration={400}>
      <ToastProvider>
        <AmbientField scope={scope} meColor={CONTOH.me.color} partnerColor={CONTOH.partner.color} />
        <div className="relative z-10 mx-auto flex max-w-(--content-max) flex-col gap-12 px-4 pb-16 pt-8 sm:px-8">
          <header className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h1 className="text-title text-primary">Galeri komponen</h1>
              <p className="text-body text-secondary">
                Halaman pengembang. Semua nama dan nominal di sini contoh, bukan data asli.
              </p>
            </div>
            <PreferencesBar />
            <div className="flex flex-col gap-2">
              <p className="text-caption text-secondary">Cakupan untuk medan ambien halaman ini</p>
              <ScopeToggle value={scope} onChange={setScope} partnerName={CONTOH.partner.name} standalone className="w-fit" />
            </div>
          </header>
          <FoundationSection />
          <GlassSection />
          <ButtonsSection />
          <FormsSection />
          <OverlaySection />
          <ContentSection />
        </div>
      </ToastProvider>
    </TooltipProvider>
  );
}
