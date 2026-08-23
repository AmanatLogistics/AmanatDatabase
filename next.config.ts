import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * The migration SQL has to travel with the deployed functions.
   *
   * Next traces what the code imports; `drizzle/` is read from disk at runtime
   * by the migrator, so nothing points at it and it would be left behind. The
   * app would then find no tables, try to create them, and fail to find the
   * files that say how.
   */
  outputFileTracingIncludes: {
    "/**": ["./drizzle/**"],
  },

  images: {
    // Product photography is not bundled with the mock dataset — `ProductThumb`
    // renders a branded placeholder whenever `imageUrl` is empty. When the real
    // backend lands, add the uploads CDN/bucket host here and the same component
    // will start rendering photos with no other changes.
    remotePatterns: [],
  },
};

export default nextConfig;
