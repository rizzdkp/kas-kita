import { cn } from "@/components/ui/cn";
import { Asset3D } from "./asset-3d";
import { pageArtFor } from "./page-art-map";

type PageArtProps = {
  pathname: string;
  /** Ukuran aset utama dalam px; pendamping 55%. */
  size: number;
  className?: string;
};

/** Aset 3D kepala halaman. Dekoratif: judul di sebelahnya sudah menamai halaman. */
export function PageArt({ pathname, size, className }: PageArtProps) {
  const art = pageArtFor(pathname);
  if (!art) return null;
  const [main, accent] = art;
  const small = Math.round(size * 0.55);
  return (
    <span
      aria-hidden
      data-page-art={main}
      className={cn("relative inline-flex shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <Asset3D name={main} size={size} eager />
      {accent ? (
        <Asset3D name={accent} size={small} eager className="absolute -bottom-1 -right-2" />
      ) : null}
    </span>
  );
}
