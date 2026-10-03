"use client";

import { useState } from "react";
import { focusQuickAdd } from "@/components/glass/quick-add-bar";
import { Avatar } from "@/components/identity/avatar";
import { IdentityDot } from "@/components/identity/identity-dot";
import { Amount } from "@/components/money/amount";
import { Delta } from "@/components/money/delta";
import { HeroNumber } from "@/components/money/hero-number";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { Section, Specimen } from "./section";

const HERO_VALUES = [3_250_000n, 2_812_500n, -140_000n];

export function ContentSection() {
  const [heroIndex, setHeroIndex] = useState(0);
  const hero = HERO_VALUES[heroIndex] ?? 0n;

  return (
    <Section id="konten" title="Konten dan angka">
      <div className="flex flex-col gap-2">
        <p className="text-small text-secondary">Aman dibelanjakan sampai gajian, 9 hari lagi (contoh)</p>
        <HeroNumber value={hero} tone={hero < 0n ? "attention" : "default"} />
        <div className="flex flex-wrap items-center gap-3">
          <Delta percent={12} comparedTo="1-10 Agu" />
          <Button variant="ghost" onClick={() => setHeroIndex((i) => (i + 1) % HERO_VALUES.length)}>
            Ganti nilai contoh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card className="flex flex-col gap-4">
          <CardTitle>Angka (contoh)</CardTitle>
          <Specimen label="Besar, Rp setengah ukuran rata atas">
            <Amount value={1_250_000n} size="large" />
          </Specimen>
          <Specimen label="Lengkap, bertanda, ringkas">
            <Amount value={1_250_000n} />
            <Amount value={-25_000n} sign="always" />
            <Amount value={8_500_000n} sign="always" />
            <Amount value={1_250_000n} format="compact" />
            <Amount value={-5_000_000n} format="compact" />
          </Specimen>
          <Specimen label="Delta">
            <Delta percent={-4.2} comparedTo="1-10 Agu" />
            <Delta percent={18.4} comparedTo="1-10 Agu" attention />
          </Specimen>
        </Card>
        <Card className="flex flex-col gap-4">
          <CardTitle>Status</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Badge tone="positive">Sesuai rencana</Badge>
            <Badge tone="attention">Lewat anggaran</Badge>
            <Badge tone="due-soon">3 hari lagi</Badge>
            <Badge tone="attention">Telat 2 hari</Badge>
            <Badge>Bersama</Badge>
          </div>
          <CardTitle>Identitas</CardTitle>
          <div className="flex flex-wrap items-center gap-3">
            <Avatar name="Contoh Saya" color="ocean" />
            <Avatar name="Contoh Partner" color="rose" size="lg" />
            <span className="flex items-center gap-2 text-small text-secondary">
              <IdentityDot shared={["ocean", "rose"]} /> Bersama
            </span>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <EmptyState
            title="Catat transaksi pertama"
            action={
              <Button variant="secondary" onClick={focusQuickAdd}>
                Fokuskan quick-add
              </Button>
            }
          >
            Ketik di bar bawah, misalnya &quot;makan siang 35rb bca&quot;.
          </EmptyState>
        </Card>
        <Card aria-busy="true" className="flex flex-col gap-4">
          <span className="sr-only">Memuat</span>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-9 w-56" />
          <SkeletonText lines={3} />
        </Card>
        <Card>
          <EmptyState title="Prediksi muncul setelah 30 hari data">Saat ini ada data 12 hari (contoh).</EmptyState>
        </Card>
        <Card className="flex flex-col gap-2">
          <CardTitle>State error (contoh)</CardTitle>
          <p className="text-body text-secondary">
            Model AI tidak merespons. Cek pengaturan AI atau isi field yang kosong sendiri.
          </p>
          <div className="pt-2">
            <Button variant="secondary">Tes koneksi</Button>
          </div>
        </Card>
      </div>
    </Section>
  );
}
