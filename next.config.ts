import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // The page was briefly called "specialist"; keep any shared links working.
    return [{ source: "/specialist", destination: "/advisor", permanent: true }];
  },
};

export default nextConfig;
