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

# founder-os#2477 — ship one-off operational scripts (e.g. the Cherry Hill
# recurring-dues backfill) so they can be invoked via `flyctl ssh console`.
# These are pure-CJS using only production deps (pg) — no tsx/esbuild needed
# on the prod image.
COPY --from=builder /app/scripts ./scripts

EXPOSE 5000

CMD ["node", "dist/index.cjs"]
