import { cn } from "@/components/ui/cn";
import { ASSET_3D_WIDTHS, asset3dSrc, type Asset3DName } from "./asset-names";

export type Asset3DProps = {
  name: Asset3DName;
  /** Ukuran tampil dalam px CSS; dipakai untuk width/height dan sizes. */
  size: number;
  /** Ganti atribut sizes bila lebar tampil berubah per breakpoint. */
  sizes?: string;
  /** Teks alternatif; tanpa ini gambar dekoratif karena teks di sebelahnya sudah menjelaskan. */
  alt?: string;
  /** Gambar di layar pertama (login, kepala halaman) dimuat segera. */
  eager?: boolean;
  className?: string;
};

/** Gambar 3D Fluent Emoji dari public/assets/3d dengan srcset 64/128/256. */
export function Asset3D({ name, size, sizes, alt, eager, className }: Asset3DProps) {
  const srcSet = ASSET_3D_WIDTHS.map((w) => `${asset3dSrc(name, w)} ${w}w`).join(", ");
  return (
    // berkas statis kecil yang sudah dikonversi ke WebP; optimizer next/image tidak menambah apa pun
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={asset3dSrc(name, size <= 32 ? 64 : size <= 64 ? 128 : 256)}
      srcSet={srcSet}
      sizes={sizes ?? `${size}px`}
      width={size}
      height={size}
      alt={alt ?? ""}
      aria-hidden={alt ? undefined : true}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      data-asset={name}
      className={cn("pointer-events-none shrink-0 select-none object-contain", className)}
    />
  );
}
