import type { NextConfig } from "next";

// Production config (Phase C).
//
// - `output: "standalone"` produces a minimal `.next/standalone` tree the
//   Dockerfile can copy — no `node_modules` blast radius, no dev deps.
//   The companion Dockerfile at /frontend/Dockerfile handles the copy.
// - Security headers (CSP, HSTS, X-Content-Type-Options,
//   Referrer-Policy, Permissions-Policy) are applied at the Next layer so
//   they survive regardless of the reverse-proxy in front. The Caddyfile
//   only needs to set transport headers (e.g. `Strict-Transport-Security`
//   re-asserts over HTTPS) and proxy /health.
const securityHeaders = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    // Permissions-Policy keeps third-party capabilities (camera, geolocation,
    // microphone, payment, USB) off by default. The product is a
    // read/analyze dashboard — none of these are ever needed.
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  {
    // Content-Security-Policy. Tight by design:
    //   - default-src 'self' so the only network surface the browser is
    //     willing to fetch is the same origin. Add the backend origin to
    //     connect-src when the analyzer moves to a server endpoint.
    //   - script-src 'self' 'unsafe-inline' — Next.js emits a small
    //     inline bootstrap script per request. A nonce would be the
    //     proper fix, but a nonce middleware is out of scope for v1;
    //     'unsafe-inline' on a same-origin-only CSP is the standard
    //     pragmatic compromise.
    //   - 'unsafe-eval' is only added in development because React's
    //     dev mode uses eval() for callstack reconstruction. The
    //     production CSP is a step tighter.
    //   - style-src 'self' 'unsafe-inline' — Next's runtime injects
    //     inline styles for font + emotion-like attributes.
    //   - img-src 'self' data: — favicon, generated charts, and inline
    //     data: URLs. No third-party imagery.
    //   - frame-ancestors 'none' — equivalent to X-Frame-Options: DENY,
    //     kept here for modern browsers.
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV !== "production" ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Apply security headers to every response. Headers checked before
  // the filesystem, so /_next/*, /public/*, and route handlers all
  // inherit them.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
