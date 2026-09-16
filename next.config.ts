import type { NextConfig } from "next";

import path from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(__dirname),
  allowedDevOrigins: [
    'localhost',
    '127.0.0.1',
    '192.168.219.102',
    '100.64.56.95',
    'localhost:3000',
    '127.0.0.1:3000',
    '192.168.219.102:3000',
    '100.64.56.95:3000',
    'justins-macbookpro.tail4ca736.ts.net',
    '*.loca.lt'
  ]
};

export default nextConfig;
