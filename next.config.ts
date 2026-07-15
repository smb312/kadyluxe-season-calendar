import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // xlsx is only used server-side in the inventory import route.
  serverExternalPackages: ["xlsx"],
};

export default nextConfig;
