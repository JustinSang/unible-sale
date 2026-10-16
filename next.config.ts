import type { NextConfig } from "next";

import path from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(__dirname),
  // 기본 보안 머리글. 지름길: CSP(Content-Security-Policy)는 인라인 스타일·글꼴 때문에 아직 넣지 않았다.
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }
      ]
    }];
  },
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
