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
    // Only on the studio's address (the website's own address is unchanged). It also answers for the
    // public pages (the proxy only gates studio paths), so everything there stays out of search
    // engines. No page there may be framed (another site, or www, overlaying the publish buttons),
    // and no studio URL is sent as a referrer to other sites.
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: STUDIO_HOST }],
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
  async redirects() {
    // The page was briefly called "specialist"; keep any shared links working.
    return [{ source: "/specialist", destination: "/advisor", permanent: true }];
  },
};

export default nextConfig;
