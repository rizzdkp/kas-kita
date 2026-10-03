import { randomUUID } from "node:crypto";
import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

// revisi halaman offline berganti tiap build supaya precache memuat versi baru
const offlineRevision = randomUUID();

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // service worker hanya di build produksi; di dev cache membuat perubahan kode tidak terlihat
  disable: process.env.NODE_ENV === "development",
  // antrean quick-add dikirim saat event online; reload otomatis memotong pengiriman itu
  reloadOnOnline: false,
  cacheOnNavigation: false,
  additionalPrecacheEntries: [{ url: "/~offline", revision: offlineRevision }],
  // sw.js dan peta sumbernya tidak ikut precache dirinya sendiri
  globPublicPatterns: ["*.{png,svg,webmanifest}"],
});

const nextConfig: NextConfig = {
  output: "standalone",
  // beberapa dev server paralel (agen, e2e) tidak boleh berbagi folder build
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  poweredByHeader: false,
  devIndicators: false,
  typedRoutes: false,
  serverExternalPackages: ["postgres", "web-push"],
  async headers() {
    // sw.js harus selalu diperiksa ulang supaya versi baru app cepat terpasang
    return [{ source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] }];
  },
};

export default withSerwist(nextConfig);
