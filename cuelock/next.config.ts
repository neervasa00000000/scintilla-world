import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  outputFileTracingRoot: path.join(__dirname),
  transpilePackages: ["leaflet"],
};

export default nextConfig;
