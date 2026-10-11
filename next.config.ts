import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Studio file uploads (max 4 MB, src/lib/studio/assets.ts) plus form overhead; the hosting
      // platform caps request bodies at 4.5 MB anyway.
      bodySizeLimit: "4.4mb",
    },
  },
  async redirects() {
    // The page was briefly called "specialist"; keep any shared links working.
    return [{ source: "/specialist", destination: "/advisor", permanent: true }];
  },
};

export default nextConfig;
