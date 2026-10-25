import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Untuk `node server.js` dalam unit systemd (docs/DEPLOY-PLAN.md).
  output: "standalone",
};

export default nextConfig;
