import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Product photography is not bundled with the mock dataset — `ProductThumb`
    // renders a branded placeholder whenever `imageUrl` is empty. When the real
    // backend lands, add the uploads CDN/bucket host here and the same component
    // will start rendering photos with no other changes.
    remotePatterns: [],
  },
};

export default nextConfig;
