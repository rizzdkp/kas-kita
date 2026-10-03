import { Asset3D } from "@/components/assets/asset-3d";
import type { Asset3DName } from "@/components/assets/asset-names";
import type { IdentityColor } from "@/components/identity/identity-colors";
import { cn } from "@/components/ui/cn";

export type IllustrationProps = {
  className?: string;
  /** Ganti label bawaan; diabaikan kalau dekoratif. */
  label?: string;
  /** Benar bila teks di sampingnya sudah menjelaskan; gambar disembunyikan dari pembaca layar. */
  decorative?: boolean;
  /** Muat segera, bukan lazy (galeri dan snapshot visual). */
  eager?: boolean;
  /** Tidak dipakai lagi sejak aset unduhan (0016); tetap diterima supaya pemanggil tidak berubah. */
  meColor?: IdentityColor | null | undefined;
  partnerColor?: IdentityColor | null | undefined;
};

export type SpotSpec = { main: Asset3DName; accent?: Asset3DName; label: string };

/** Ilustrasi spot persegi: aset 3D utama dan satu pendamping kecil di kanan bawah. Lebar dari className pemanggil. */
export function Spot({ spec, className, label, decorative, eager }: IllustrationProps & { spec: SpotSpec }) {
  return (
    <span
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": label ?? spec.label })}
      data-illustration={spec.main}
      className={cn("relative block aspect-square w-full max-w-full shrink-0", className)}
    >
      <Asset3D
        name={spec.main}
        size={144}
        sizes="(min-width: 600px) 144px, 112px"
        eager={eager}
        className={cn("absolute left-0 top-0", spec.accent ? "h-5/6 w-5/6" : "h-full w-full")}
      />
      {spec.accent ? <Asset3D name={spec.accent} size={64} eager={eager} className="absolute bottom-0 right-0 h-5/12 w-5/12" /> : null}
    </span>
  );
}
