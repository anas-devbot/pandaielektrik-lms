import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Untuk `node server.js` dalam unit systemd (docs/DEPLOY-PLAN.md).
  output: "standalone",
  // Muat naik skematik melalui Server Action. ASSUMPTION: courses.config.schematic_max_mb = 10 (belum disahkan Saiful);
  // jika dinaikkan melebihi ~11 MB, naikkan had ini dan client_max_body_size nginx sekali.
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
};

export default nextConfig;
