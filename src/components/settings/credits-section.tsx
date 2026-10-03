import { ExternalLink } from "lucide-react";
import { Asset3D } from "@/components/assets/asset-3d";
import { Icon } from "@/components/ui/icon";

type Credit = {
  title: string;
  body: string;
  links: ReadonlyArray<{ href: string; label: string }>;
  art: "house-with-garden" | "bank";
};

// atribusi wajib: CC BY-NC 4.0 meminta nama, tautan lisensi, dan keterangan perubahan
const CREDITS: readonly Credit[] = [
  {
    title: "Gambar 3D: Microsoft Fluent Emoji",
    body: "Hak cipta Microsoft Corporation, lisensi MIT. Dipakai di kepala halaman, kategori, jenis akun, halaman masuk, dan state kosong. Diubah ke WebP ukuran 64, 128, dan 256 px tanpa mengubah gambarnya.",
    links: [
      { href: "https://github.com/microsoft/fluentui-emoji", label: "Repositori Fluent Emoji" },
      { href: "/assets/licenses/fluentui-emoji-MIT.txt", label: "Teks lisensi MIT" },
    ],
    art: "house-with-garden",
  },
  {
    title: "Logo bank dan e-wallet: idn-finlogos 2.5.0",
    body: "Koleksi oleh Hafidz Noor Fauzi, lisensi CC BY-NC 4.0, hanya untuk pemakaian non-komersial. Setiap logo adalah merek dagang pemiliknya dan dipakai hanya sebagai penanda akun, tanpa afiliasi atau dukungan dari pemilik merek. Berkas SVG hanya ditambah atribut namespace supaya bisa dimuat sebagai gambar.",
    links: [
      { href: "https://github.com/hafidznoor/idn-finlogos", label: "Repositori idn-finlogos" },
      { href: "https://creativecommons.org/licenses/by-nc/4.0/deed.id", label: "Lisensi CC BY-NC 4.0" },
      { href: "/assets/licenses/idn-finlogos-NOTICE.txt", label: "Pemberitahuan merek dagang" },
    ],
    art: "bank",
  },
];

/** Atribusi aset unduhan (docs/decisions/0016). */
export function CreditsSection() {
  return (
    <ul className="flex flex-col divide-y divide-border">
      {CREDITS.map((c) => (
        <li key={c.title} className="flex gap-3 py-4 first:pt-0 last:pb-0">
          <Asset3D name={c.art} size={32} className="mt-0.5 self-start" />
          <div className="flex min-w-0 flex-col gap-1">
            <h3 className="text-control font-semibold text-primary">{c.title}</h3>
            <p className="max-w-[65ch] text-small text-secondary">{c.body}</p>
            <ul className="flex flex-wrap gap-x-4">
              {c.links.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center gap-1 text-small text-accent underline-offset-2 hover:underline sm:min-h-8"
                  >
                    {l.label}
                    <Icon icon={ExternalLink} size={16} />
                    <span className="sr-only">(tab baru)</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </li>
      ))}
    </ul>
  );
}
