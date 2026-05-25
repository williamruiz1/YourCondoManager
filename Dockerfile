FROM node:20-alpine AS builder

WORKDIR /app

# Build-time env vars for Vite (baked into client bundle)
ARG VITE_GOOGLE_MAPS_API_KEY
ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . .
RUN npm run build

# ── Production image ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Only copy production deps
COPY package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps

# Copy built artifacts (public/ is inside dist/ per vite outDir config)
COPY --from=builder /app/dist ./dist

# founder-os #2476 — migration runner needs the migrations folder AND the
# `scripts/migrate.cjs` + `scripts/backfill-migration-journal.cjs` runner
# scripts at runtime so Fly's `release_command` can invoke them. Copy
# explicitly so we don't drag in dev-only roadmap-seed scripts.
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/scripts/migrate.cjs ./scripts/migrate.cjs
COPY --from=builder /app/scripts/backfill-migration-journal.cjs ./scripts/backfill-migration-journal.cjs

EXPOSE 5000

CMD ["node", "dist/index.cjs"]
