import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  // 開發時透過 Cloudflare 臨時通道讓手機和 LINE 連進來。
  allowedDevOrigins: ["*.trycloudflare.com"],
  outputFileTracingRoot: __dirname,
  turbopack: { root: __dirname },
  serverExternalPackages: ["@google-cloud/firestore", "@google-cloud/storage", "sharp"],
  // 去背圖從瀏覽器上傳，預設 1MB 不夠。
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
};

export default config;
