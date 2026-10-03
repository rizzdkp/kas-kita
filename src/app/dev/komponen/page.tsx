import type { Metadata } from "next";
import { Gallery } from "./_sections/gallery";

export const metadata: Metadata = { title: "Galeri komponen", robots: { index: false } };

/** Halaman pengembang untuk verifikasi visual komponen; semua data di sini contoh. */
export default function KomponenPage() {
  return <Gallery />;
}
