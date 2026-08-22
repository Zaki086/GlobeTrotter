# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Multi-stage build. The runtime image carries only production dependencies,
# the compiled JS and the Prisma schema — no TypeScript sources, no dev tools.
# ---------------------------------------------------------------------------

# --- Stage 1: install every dependency (dev included) for the build ---------
FROM node:20-alpine AS deps

WORKDIR /app

# Prisma's engines need OpenSSL on Alpine.
RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
RUN npm ci

# --- Stage 2: compile TypeScript and generate the Prisma client -------------
FROM node:20-alpine AS build

WORKDIR /app
RUN apk add --no-cache openssl

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.json ./
COPY prisma ./prisma
COPY src ./src

RUN npx prisma generate
RUN npm run build

# --- Stage 3: production dependencies only ----------------------------------
FROM node:20-alpine AS prod-deps

WORKDIR /app
RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
RUN npm ci --omit=dev
# The generated client lives in node_modules, so regenerate it here too.
COPY prisma ./prisma
RUN npx prisma generate

# --- Stage 4: runtime -------------------------------------------------------
FROM node:20-alpine AS runtime

WORKDIR /app

RUN apk add --no-cache openssl curl tini

ENV NODE_ENV=production
ENV PORT=4000

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY prisma ./prisma

# Migrations and the seed run from the container, so keep the CLI available.
COPY --from=deps /app/node_modules/prisma ./node_modules/prisma
COPY --from=deps /app/node_modules/tsx ./node_modules/tsx

# Log directory must be writable by the unprivileged user.
RUN mkdir -p /app/logs && chown -R node:node /app

# Never run as root.
USER node

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:${PORT}/api/v1/health || exit 1

# tini reaps zombies and forwards SIGTERM so graceful shutdown actually runs.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/src/server.js"]
