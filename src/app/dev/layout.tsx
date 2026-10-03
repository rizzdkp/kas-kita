import { notFound } from "next/navigation";

// dibaca per permintaan supaya KASKITA_DEV_PAGES di server produksi (e2e visual) berlaku tanpa build ulang
export const dynamic = "force-dynamic";

/** Halaman /dev/* hanya untuk pengembang: mati di produksi kecuali KASKITA_DEV_PAGES=1. */
export default function DevLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production" && process.env.KASKITA_DEV_PAGES !== "1") notFound();
  return children;
}
