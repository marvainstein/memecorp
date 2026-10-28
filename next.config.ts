import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The floating dev badge sits on top of the Start button.
  devIndicators: false,
  // Native / WASM packages must stay outside the server bundle.
  serverExternalPackages: ["@electric-sql/pglite", "sharp", "pg", "tesseract.js", "cheerio"],
  experimental: {
    // Admin bulk uploads go through route handlers; keep server actions generous anyway.
    serverActions: { bodySizeLimit: "25mb" },
    // proxy.ts (admin Basic Auth) buffers request bodies; the default 10MB would truncate large uploads.
    proxyClientMaxBodySize: "25mb",
  },
};

export default nextConfig;
