"use client";

import { GlassSurface } from "@/components/glass/glass-surface";
import { QuickAddBar } from "@/components/glass/quick-add-bar";
import { IdentityDot } from "@/components/identity/identity-dot";
import { Amount } from "@/components/money/amount";
import { useToast } from "@/components/ui/toast";
import { Section, Specimen } from "./section";

const ROWS = [
  { merchant: "Contoh kopi", meta: "Kopi dan jajan · GoPay", amount: -25000n, owner: "ocean" as const },
  { merchant: "Contoh gaji", meta: "Gaji · BCA", amount: 8500000n, owner: "rose" as const },
  { merchant: "Contoh belanja dapur", meta: "Belanja · Bank Jago", amount: -185000n, owner: "ocean" as const },
  { merchant: "Contoh listrik", meta: "Tagihan · BCA", amount: -412500n, owner: "rose" as const },
];

/** Latar sibuk supaya blur, saturasi, dan kontras teks glass bisa dinilai (DESIGN 5.7). */
function BusyBackdrop() {
  return (
    <div className="flex flex-col rounded-card border border-border bg-surface">
      {ROWS.map((row) => (
        <div key={row.merchant} className="flex h-14 items-center gap-3 border-b border-border px-4 last:border-b-0">
          <IdentityDot color={row.owner} />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-body text-primary">{row.merchant}</span>
            <span className="truncate text-caption text-secondary">{row.meta}</span>
          </div>
          <Amount value={row.amount} sign="always" />
        </div>
      ))}
      <svg viewBox="0 0 400 80" className="h-20 w-full" aria-hidden>
        <polyline
          points="0,60 50,52 100,58 150,30 200,40 250,22 300,34 350,12 400,20"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
        />
        <polyline
          points="0,70 50,64 100,66 150,50 200,58 250,44 300,52 350,40 400,46"
          fill="none"
          stroke="var(--text-secondary)"
          strokeWidth="2"
          strokeDasharray="4 4"
        />
      </svg>
    </div>
  );
}

export function GlassSection() {
  const { show } = useToast();
  return (
    <Section id="glass" title="Glass">
      <div className="relative">
        <BusyBackdrop />
        <GlassSurface className="absolute inset-x-4 top-8 flex h-15 items-center justify-between gap-3 px-6">
          <span className="text-control text-primary">Teks primer di atas glass</span>
          <span className="text-control text-secondary">Sekunder</span>
        </GlassSurface>
        <GlassSurface variant="regular" className="absolute bottom-6 right-4 w-64 p-4">
          <p className="text-control text-primary">Glass regular</p>
          <p className="text-control text-secondary">Sheet, dialog, toast, menu</p>
        </GlassSurface>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <Specimen label="Quick-add, cakupan Saya" className="*:w-full">
          <QuickAddBar scope="me" onSubmit={(text) => show({ title: `Contoh: "${text}" belum diproses` })} />
        </Specimen>
        <Specimen label="Quick-add, cakupan Partner" className="*:w-full">
          <QuickAddBar scope="partner" partnerName="Contoh Partner" partnerColor="rose" />
        </Specimen>
        <Specimen label="Quick-add, sedang memproses" className="*:w-full">
          <QuickAddBar scope="me" busy />
        </Specimen>
      </div>
    </Section>
  );
}
