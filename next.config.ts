import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fully static site: `npm run build` writes plain files to ./out for any static host.
  output: "export",
  // /systems/youtube/ → systems/youtube/index.html, which every static host serves.
  trailingSlash: true,
};

export default nextConfig;
