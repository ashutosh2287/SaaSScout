# Sasscout backend production image (STEP 31).
# The backend is the OPTIONAL health-only infrastructure boundary. It never
# receives transaction/report data and contains no secrets; this image is built
# from public code only, runs as a non-root user, and bakes NO .env file.

# --- build stage ------------------------------------------------------------
FROM node:24-alpine AS build
WORKDIR /app

# Install dependencies first (better layer caching).
COPY package.json package-lock.json ./
RUN npm ci

# Compile TypeScript to dist/.
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- runtime stage ----------------------------------------------------------
FROM node:24-alpine

# Run as the non-root node user (Node 24 alpine images ship a `node` user).
WORKDIR /app
ENV NODE_ENV=production

# Copy only the compiled output and the production dependency tree.
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist

USER node

# Expose the internal backend port (NOT the public one — a TLS-terminating
# reverse proxy is expected in front and talks to this port on a private net).
EXPOSE 3001

# No .env is baked in. Configuration comes from the runtime environment
# (PORT, HOST, TRUST_PROXY, HSTS_ENABLED, CORS_ORIGIN, RATE_LIMIT_*).
CMD ["node", "dist/index.js"]
