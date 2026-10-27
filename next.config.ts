import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Untuk `node server.js` dalam unit systemd (docs/DEPLOY-PLAN.md).
  output: "standalone",
  // Muat naik skematik melalui Server Action. ASSUMPTION: courses.config.schematic_max_mb = 10 (belum disahkan Saiful);
  // jika dinaikkan melebihi ~11 MB, naikkan had ini dan client_max_body_size nginx sekali.
  // Header asas (audit Pintu 1). CSP sengaja belum ditambah: perlu uji dengan YouTube IFrame API + skrip inline Next dahulu.
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
      { key: "Strict-Transport-Security", value: "max-age=31536000" },
    ] }];
  },
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
};

export default nextConfig;
