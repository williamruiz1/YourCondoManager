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
# scripts at runtime so Fly's `release_command` can invoke them.
# founder-os#2477 — also ship one-off operational scripts (e.g. the Cherry
# Hill recurring-dues backfill) so they can be invoked via `flyctl ssh console`.
# Copy the whole scripts/ folder (covers both); migrations/ is separate.
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/scripts ./scripts

EXPOSE 5000

CMD ["node", "dist/index.cjs"]
