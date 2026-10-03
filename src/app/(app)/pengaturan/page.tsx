import type { Metadata } from "next";
import { listSessions, requireViewer } from "@/server/auth/session";
import { getAiSettingsView } from "@/server/queries/ai-settings";
import { getVapidConfig } from "@/server/push/config";
import { listCategories } from "@/server/queries/categories";
import { AiSettingsForm } from "@/components/settings/ai-section";
import { AppearanceSettings } from "@/components/settings/appearance-section";
import { CategoriesManager } from "@/components/settings/categories-section";
import { CreditsSection } from "@/components/settings/credits-section";
import { NotificationsPushSection } from "@/components/settings/notifications-push-section";
import { ExportAllLink } from "@/components/settings/export-link";
import { PaydayForm } from "@/components/settings/payday-section";
import { ProfileForm } from "@/components/settings/profile-section";
import { ChangePasswordForm } from "@/components/settings/security-section";
import { SessionsList } from "@/components/settings/sessions-list";
import { SettingsAnchorNav, SettingsIndexList, type SettingsNavItem } from "@/components/settings/settings-nav";
import { SettingsSection } from "@/components/settings/settings-section";

export const metadata: Metadata = { title: "Pengaturan" };

// templat impor menyusul bersama fitur impor (M4)
const SECTIONS: readonly SettingsNavItem[] = [
  { id: "profil", label: "Profil" },
  { id: "gajian", label: "Gajian dan periode" },
  { id: "tampilan", label: "Tampilan" },
  { id: "notifikasi", label: "Notifikasi" },
  { id: "kategori", label: "Kategori" },
  { id: "keamanan", label: "Keamanan" },
  { id: "sesi", label: "Sesi" },
  { id: "ai", label: "AI" },
  { id: "ekspor", label: "Ekspor" },
  { id: "tentang", label: "Tentang dan lisensi aset" },
];

export default async function PengaturanPage() {
  const viewer = await requireViewer();
  const [sessions, categories, ai] = await Promise.all([listSessions(viewer), listCategories({ includeArchived: true }), getAiSettingsView()]);
  // hanya field yang aman untuk browser; key tidak pernah ikut (F-AI-1 AC3)
  const aiSettings = ai
    ? { version: ai.version, baseUrl: ai.baseUrl, apiKeyLast4: ai.apiKeyLast4, textModel: ai.textModel, visionModel: ai.visionModel }
    : null;
  const partner = viewer.partner ? { name: viewer.partner.displayName, color: viewer.partner.identityColor } : null;

  return (
    <div className="grid gap-8 lg:grid-cols-[200px_minmax(0,1fr)]">
      <SettingsAnchorNav items={SECTIONS} />
      <div className="flex min-w-0 max-w-3xl flex-col gap-10">
        <SettingsIndexList items={SECTIONS} />

        <SettingsSection id="profil" title="Profil" description="Nama dan warna yang menandai data milikmu.">
          <ProfileForm displayName={viewer.user.displayName} identityColor={viewer.user.identityColor} partner={partner} />
        </SettingsSection>

        <SettingsSection
          id="gajian"
          title="Gajian dan periode"
          description="Dipakai untuk hitung mundur Aman dibelanjakan dan rentang anggaran serta laporan."
        >
          <PaydayForm paydayDay={viewer.user.paydayDay} periodMode={viewer.user.periodMode} />
        </SettingsSection>

        <SettingsSection id="tampilan" title="Tampilan">
          <AppearanceSettings />
        </SettingsSection>

        <SettingsSection
          id="notifikasi"
          title="Notifikasi"
          description="Kabar selalu muncul di panel Notifikasi. Aktifkan notifikasi perangkat supaya kabarnya juga sampai saat Kas Kita tertutup."
        >
          {/* hanya kunci publik yang dikirim ke browser */}
          <NotificationsPushSection publicKey={getVapidConfig()?.publicKey ?? null} />
        </SettingsSection>

        <SettingsSection
          id="kategori"
          title="Kategori"
          description="Kategori dipakai kalian berdua. Kategori yang diarsipkan tidak muncul di pilihan baru, tetapi transaksi lamanya tetap."
        >
          <CategoriesManager categories={categories} />
        </SettingsSection>

        <SettingsSection
          id="keamanan"
          title="Keamanan"
          description="Ganti password untuk masuk ke Kas Kita. Perangkat lain yang sedang masuk akan dikeluarkan."
        >
          <ChangePasswordForm />
        </SettingsSection>

        <SettingsSection
          id="sesi"
          title="Sesi"
          description="Perangkat yang sedang masuk dengan akunmu. Keluarkan perangkat yang hilang atau tidak kamu kenali."
        >
          <SessionsList sessions={sessions} />
        </SettingsSection>

        <SettingsSection
          id="ai"
          title="AI"
          description="Foto struk dan teks transaksi dikirim ke penyedia yang kamu pasang di sini. Angka di Ringkasan selalu dihitung Kas Kita, bukan AI."
        >
          <AiSettingsForm initial={aiSettings} />
        </SettingsSection>

        <SettingsSection
          id="ekspor"
          title="Ekspor"
          description="Satu file zip berisi data.json (akun, transaksi, kategori, anggaran, tagihan, target, dan riwayat perubahan) beserta lampiran struk. Data login dan API key tidak ikut."
        >
          <ExportAllLink />
        </SettingsSection>

        <SettingsSection
          id="tentang"
          title="Tentang dan lisensi aset"
          description="Gambar dan logo di Kas Kita berasal dari koleksi terbuka berikut."
        >
          <CreditsSection />
        </SettingsSection>
      </div>
    </div>
  );
}
