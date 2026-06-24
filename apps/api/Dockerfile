# ── Stage 1: dependency install (cached by lockfile) ──────────────────────────
FROM node:22-alpine AS deps
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ── Stage 2: build ─────────────────────────────────────────────────────────────
FROM deps AS builder
COPY packages/shared/ ./packages/shared/
COPY apps/api/ ./apps/api/

RUN pnpm --filter @drift/shared build
RUN pnpm --filter @drift/api build

# ── Stage 3: pruned production deploy ─────────────────────────────────────────
FROM deps AS pruner
COPY --from=builder /repo/packages/shared/dist ./packages/shared/dist
COPY --from=builder /repo/apps/api/dist ./apps/api/dist
RUN pnpm --filter @drift/api deploy --prod /deploy

# ── Stage 4: minimal runtime image ────────────────────────────────────────────
FROM node:22-alpine AS runner
RUN addgroup -g 1001 -S drift && adduser -S drift -u 1001 -G drift

WORKDIR /app
COPY --from=pruner --chown=drift:drift /deploy ./
# Copy compiled output (pnpm deploy copies src, not dist)
COPY --from=builder --chown=drift:drift /repo/apps/api/dist ./dist
COPY --from=builder --chown=drift:drift /repo/apps/api/prisma ./prisma

USER drift
EXPOSE 4000
ENV NODE_ENV=production

# Run migrations then start (Railway / Fly will exec this)
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
