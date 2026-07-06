import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Zippy is a pure-JS route planner; nothing exotic needed yet.
  // The bundled SDE graph is imported as JSON from lib/sde/data.
  experimental: {
    // Allow importing the (large) generated star-map JSON.
    largePageDataBytes: 8 * 1024 * 1024,
  },
};

export default nextConfig;
