# ── Stage 1: deps ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ── Stage 2: build ─────────────────────────────────────────────────────────────
FROM deps AS builder
COPY packages/shared/ ./packages/shared/
COPY apps/web/ ./apps/web/

RUN pnpm --filter @drift/shared build
ENV NEXT_OUTPUT=standalone
RUN pnpm --filter @drift/web build

# ── Stage 3: runner (Next.js standalone) ──────────────────────────────────────
FROM node:22-alpine AS runner
RUN addgroup -g 1001 -S drift && adduser -S drift -u 1001 -G drift

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Next.js standalone bundles its own node_modules copy
COPY --from=builder --chown=drift:drift /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=drift:drift /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=drift:drift /repo/apps/web/public ./apps/web/public

USER drift
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "apps/web/server.js"]
