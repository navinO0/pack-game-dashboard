# 1. Base Alpine image with essential libraries
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat openssl dumb-init bash
WORKDIR /app

# 2. Dependencies stage
FROM base AS deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline --no-audit --no-fund

# 3. Builder stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG PRISMA_SCHEMA=prisma/postgres/schema.prisma
ARG NEXT_PUBLIC_APP_NAME="PackScore Pro"
ARG NEXT_PUBLIC_CURRENCY_SYMBOL="₹"
ARG NEXT_PUBLIC_CURRENCY_CODE="INR"

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV DOCKER_BUILD=1
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV NEXT_PUBLIC_APP_NAME=${NEXT_PUBLIC_APP_NAME}
ENV NEXT_PUBLIC_CURRENCY_SYMBOL=${NEXT_PUBLIC_CURRENCY_SYMBOL}
ENV NEXT_PUBLIC_CURRENCY_CODE=${NEXT_PUBLIC_CURRENCY_CODE}

# Generate Prisma Client for the dedicated PostgreSQL schema (pack_score_calc)
RUN npx prisma generate --schema=${PRISMA_SCHEMA}
RUN npx next build

# 4. Production runner stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV DB_SCHEMA_NAME="pack_score_calc"
ENV AUTO_MIGRATE="true"

# Non-root user for security (UID 1001)
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Set correct permissions for prerender cache & public/env.js runtime generation
RUN mkdir -p .next/cache public && chown -R nextjs:nodejs .next public

# Copy static assets and standalone bundle
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma schema, migrations, CLI, and generated client for startup migrations
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma

# Copy runtime entrypoint script (injects runtime env & runs schema-scoped migrations)
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER nextjs

EXPOSE ${PORT}

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:${PORT}/api/health || exit 1

ENTRYPOINT ["dumb-init", "--", "./docker-entrypoint.sh"]
CMD ["node", "server.js"]
