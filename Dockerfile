# ─── Stage 1: Dependencies ────────────────────────────────
FROM oven/bun:1.3.14-alpine AS deps

WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install production dependencies only
RUN bun install --frozen-lockfile --production

# ─── Stage 2: Builder ─────────────────────────────────────
FROM oven/bun:1.3.14-alpine AS builder

WORKDIR /app

# Copy all dependencies (including dev for build)
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile

# Copy source
COPY . .

# Generate Prisma client
RUN bunx prisma generate

# Build the application
RUN bun build src/app.ts --outdir dist --target bun --minify

# ─── Stage 3: Production ──────────────────────────────────
FROM oven/bun:1.3.14-alpine AS production

WORKDIR /app

# Security: run as non-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S appuser -u 1001 -G nodejs

# Copy production deps
COPY --from=deps --chown=appuser:nodejs /app/node_modules ./node_modules

# Copy built assets and Prisma client
COPY --from=builder --chown=appuser:nodejs /app/dist ./dist
COPY --from=builder --chown=appuser:nodejs /app/prisma ./prisma
COPY --from=builder --chown=appuser:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=appuser:nodejs /app/package.json ./

USER appuser

EXPOSE 3000

ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["bun", "dist/app.js"]
