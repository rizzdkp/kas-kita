import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // beberapa dev server paralel (agen, e2e) tidak boleh berbagi folder build
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  poweredByHeader: false,
  devIndicators: false,
  typedRoutes: false,
  serverExternalPackages: ["postgres"],
};

export default nextConfig;
