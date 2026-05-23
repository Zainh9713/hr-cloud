import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdnjs.cloudflare.com https://unpkg.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: blob:",
              "font-src 'self' https://fonts.gstatic.com data:",
              "connect-src 'self' ws://localhost:3001 wss://localhost:3001 ws://* wss://* http://localhost:3000 http://127.0.0.1:* http://localhost:* https://*",
              "frame-src 'self' https://view.officeapps.live.com",
              "media-src 'self' blob:",
              "object-src 'none'",
              "worker-src 'self' blob: https://cdnjs.cloudflare.com https://unpkg.com",
              "child-src 'self' blob: https://cdnjs.cloudflare.com https://unpkg.com",
            ].join("; "),
          },
        ],
      },
    ];
  },
  output: "standalone",
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
};

const withPWA = require("next-pwa")({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
});

export default withPWA(nextConfig);
