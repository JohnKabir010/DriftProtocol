# ── Stage 1: deps ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/realtime/package.json ./apps/realtime/

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ── Stage 2: build ─────────────────────────────────────────────────────────────
FROM deps AS builder
COPY packages/shared/ ./packages/shared/
COPY apps/realtime/ ./apps/realtime/

RUN pnpm --filter @drift/shared build
RUN pnpm --filter @drift/realtime build

# ── Stage 3: pruned deploy ─────────────────────────────────────────────────────
FROM deps AS pruner
COPY --from=builder /repo/packages/shared/dist ./packages/shared/dist
RUN pnpm --filter @drift/realtime deploy --prod /deploy

# ── Stage 4: runner ────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
RUN addgroup -g 1001 -S drift && adduser -S drift -u 1001 -G drift

WORKDIR /app
COPY --from=pruner --chown=drift:drift /deploy ./
COPY --from=builder --chown=drift:drift /repo/apps/realtime/dist ./dist

USER drift
EXPOSE 2567
ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
