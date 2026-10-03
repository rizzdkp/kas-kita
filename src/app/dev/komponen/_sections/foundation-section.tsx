import { IdentityDot } from "@/components/identity/identity-dot";
import type { IdentityColor } from "@/components/identity/identity-colors";
import { Section, Specimen } from "./section";

const COLORS = [
  ["canvas", "bg-canvas"],
  ["surface", "bg-surface"],
  ["surface-sunken", "bg-surface-sunken"],
  ["accent", "bg-accent"],
  ["positive", "bg-positive"],
  ["attention", "bg-attention"],
  ["due-soon", "bg-due-soon"],
  ["error", "bg-error"],
] as const;

const IDENTITIES: IdentityColor[] = ["violet", "rose", "gold", "ocean", "plum", "slate"];

const TYPE = [
  ["Judul halaman 28/600", "text-title"],
  ["Judul bagian 20/600", "text-section"],
  ["Judul kartu 16/500", "text-card"],
  ["Body 16/400", "text-body"],
  ["Body kecil 14/400", "text-small"],
  ["Label kontrol 15/500", "text-control"],
  ["Keterangan 12/400", "text-caption"],
] as const;

export function FoundationSection() {
  return (
    <Section id="fondasi" title="Fondasi">
      <div className="grid gap-6 rounded-card border border-border bg-surface p-4 sm:grid-cols-2 sm:p-(--space-card)">
        <Specimen label="Warna peran">
          {COLORS.map(([name, cls]) => (
            <span key={name} className="flex items-center gap-2 text-small text-primary">
              <span className={`size-6 rounded-xs border border-border ${cls}`} />
              {name}
            </span>
          ))}
        </Specimen>
        <Specimen label="Warna identitas, titik 8px dengan ring surface">
          {IDENTITIES.map((c) => (
            <span key={c} className="flex items-center gap-2 text-small text-primary">
              <IdentityDot color={c} />
              {c}
            </span>
          ))}
          <span className="flex items-center gap-2 text-small text-primary">
            <IdentityDot shared={["ocean", "rose"]} label="Bersama" />
            Bersama
          </span>
        </Specimen>
        <Specimen label="Teks" className="sm:col-span-2">
          <div className="flex flex-col gap-2">
            <span className="text-primary">Primer: Aman dibelanjakan</span>
            <span className="text-secondary">Sekunder: diisi oleh Contoh Partner</span>
            <span className="text-tertiary">Tersier: hanya teks besar atau non-esensial</span>
          </div>
        </Specimen>
        <Specimen label="Skala tipe" className="sm:col-span-2">
          <div className="flex flex-col gap-2">
            {TYPE.map(([label, cls]) => (
              <span key={cls} className={`${cls} text-primary`}>
                {label}
              </span>
            ))}
          </div>
        </Specimen>
      </div>
    </Section>
  );
}
