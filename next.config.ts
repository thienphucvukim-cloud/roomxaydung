import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vinext checks multipart POST bodies before dispatching App Router APIs.
  // Leave room for multipart headers around the 100 MiB private file limit.
  experimental: {
    serverActions: { bodySizeLimit: "101mb" },
  },
};

export default nextConfig;
