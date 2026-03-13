# Stage 1: Install dependencies
FROM node:22-alpine AS deps
WORKDIR /app

# Server dependencies
COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm ci

# Client dependencies
COPY client/package.json client/package-lock.json* ./client/
RUN cd client && npm ci

# Stage 2: Build server and client
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/server/node_modules ./server/node_modules
COPY --from=deps /app/client/node_modules ./client/node_modules

COPY server/ ./server/
COPY client/ ./client/

# Generate Prisma client and build the server
RUN cd server && npx prisma generate && npm run build

# Build the client
RUN cd client && npm run build

# Stage 3: Production image
FROM node:22-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser

# Copy server dependencies (with generated Prisma client from builder stage)
COPY --from=builder /app/server/node_modules ./node_modules
COPY --from=builder /app/server/dist ./dist
COPY --from=builder /app/server/package.json ./package.json
COPY --from=builder /app/server/prisma ./prisma

# Copy client build output into the public directory served by Express
COPY --from=builder /app/client/dist ./public

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/health/live || exit 1

ENTRYPOINT ["node", "dist/server.js"]
