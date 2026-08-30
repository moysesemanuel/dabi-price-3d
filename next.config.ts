import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import { isSentrySourceMapUploadEnabled } from "./src/lib/observability/sentry-config";

const nextConfig: NextConfig = {
  devIndicators: false,
  env: {
    NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV,
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA,
    NEXT_PUBLIC_SENTRY_ENVIRONMENT: process.env.SENTRY_ENVIRONMENT,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
};

const shouldUploadSourceMaps = isSentrySourceMapUploadEnabled({
  authToken: process.env.SENTRY_AUTH_TOKEN,
  isVercel: Boolean(process.env.VERCEL),
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
});

export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  // Inclui chunks internos do Next.js, necessarios para desminificar frames do runtime.
  widenClientFileUpload: true,
  sourcemaps: {
    disable: !shouldUploadSourceMaps,
  },
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
