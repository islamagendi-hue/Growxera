import type { NextConfig } from "next";
import { STUDIO_HOST } from "./src/lib/studio/host";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Studio file uploads (max 4 MB, src/lib/studio/assets.ts) plus form overhead; the hosting
      // platform caps request bodies at 4.5 MB anyway.
      bodySizeLimit: "4.4mb",
    },
  },
  async headers() {
    // The studio's address also answers for the public pages (the proxy only gates studio paths).
    // Keep everything on it out of search engines; the website's own address is unchanged.
    return [{ source: "/:path*", has: [{ type: "host", value: STUDIO_HOST }], headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }];
  },
  async redirects() {
    // The page was briefly called "specialist"; keep any shared links working.
    return [{ source: "/specialist", destination: "/advisor", permanent: true }];
  },
};

export default nextConfig;
