# Sasscout frontend — multi-stage Dockerfile.
#
# Two stages:
#   1. builder: installs full deps, runs `next build` with the
#      standalone output. The standalone tree contains the server
#      entry, the .next/static assets, and a pruned node_modules.
#   2. runner: copies the standalone tree, the public/ dir, and the
#      .next/static dir. Runs `node server.js` on a non-root user.
#
# Why this shape:
#   - The image is ~150 MB because dev deps are dropped at the runner
#     stage. The runner doesn't even have npm; the standalone server
#     only needs the runtime files Next traced.
#   - We don't COPY the source tree. The build context ships only
#     package*.json, next.config.ts, public/, and the application
#     source — and the builder only keeps the standalone output.
#   - Non-root USER node (uid 1000) is the Next convention; the runner
#     image ships with this user already.

# ----- builder -----
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# Install only the deps needed to build. `npm ci` is reproducible; the
# standalone tree will be ~50% smaller than the full `node_modules`.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Bring in the rest of the source. A `.dockerignore` keeps tests,
# fixtures, and the .next cache out of the build context.
COPY . .

# Build with standalone output. This writes .next/standalone/, the
# pruned node_modules, plus .next/static/ for the static assets.
RUN npm run build

# ----- runner -----
FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# The Next standalone server reads these to locate the static assets
# we copy below; the defaults are correct for our layout.
ENV NEXT_TELEMETRY_DISABLED=1

# `node` user is shipped with the official image (uid 1000). Running as
# non-root is a baseline expectation for any public-facing container.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

USER node
EXPOSE 3000

# `server.js` is the entry Next generates for `output: "standalone"`.
# It is equivalent to `next start` but with the production-ready
# server the standalone build emits.
CMD ["node", "server.js"]
