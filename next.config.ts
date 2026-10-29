import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The floating dev badge sits on top of the Start button.
  devIndicators: false,
  // Native / WASM packages must stay outside the server bundle.
  serverExternalPackages: ["@electric-sql/pglite", "sharp", "pg", "tesseract.js", "cheerio"],
  // OCR runs its worker script in a separate thread, loaded from a path the build can't trace, so its
  // files and dependencies are listed by hand. Only the routes that run imports need them (keeps the
  // other serverless functions small). Keys are globs: `*` stands for the dynamic [id] segment.
  outputFileTracingIncludes: Object.fromEntries(
    ["/api/cron/import", "/api/admin/sources/*"].map((route) => [
      route,
      [
        "./node_modules/{tesseract.js,tesseract.js-core,wasm-feature-detect,bmp-js,zlibjs,is-url,regenerator-runtime}/**/*.{js,cjs,wasm,json}",
        "./node_modules/{node-fetch,whatwg-url,tr46,webidl-conversions}/**/*.{js,json}",
        "./node_modules/@tesseract.js-data/{eng,spa}/4.0.0_best_int/*.traineddata.gz",
      ],
    ]),
  ),
  experimental: {
    // Admin bulk uploads go through route handlers; keep server actions generous anyway.
    serverActions: { bodySizeLimit: "25mb" },
    // proxy.ts (admin Basic Auth) buffers request bodies; the default 10MB would truncate large uploads.
    proxyClientMaxBodySize: "25mb",
  },
};

export default nextConfig;
