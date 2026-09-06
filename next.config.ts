import type { NextConfig } from "next";
import path from "node:path";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Content-Security-Policy. Next.js needs inline scripts for hydration, and the
 * Turbopack dev server needs eval; both are limited to what the framework requires.
 * Stripe is reached only by a server-side redirect, so no Stripe script or frame is loaded.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'" + (isDev ? " ws: wss:" : ""),
  // Server actions answer form posts with a redirect; Chrome applies form-action to that hop, so allow Stripe's hosted checkout.
  "form-action 'self' https://checkout.stripe.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
]
  .filter((d) => !(isDev && d === "upgrade-insecure-requests"))
  .join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
];

const nextConfig: NextConfig = {
  // Pin the workspace root so a stray lockfile in a parent folder is ignored.
  turbopack: { root: path.resolve(__dirname) },
  poweredByHeader: false,
  experimental: {
    // CSV imports are capped at 2 MB; allow multipart overhead.
    serverActions: { bodySizeLimit: "3mb" },
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
