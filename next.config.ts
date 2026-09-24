import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  typedRoutes: false,
  serverExternalPackages: ["postgres"],
};

export default nextConfig;
