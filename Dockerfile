# syntax=docker/dockerfile:1
FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS builder
WORKDIR /app
COPY server/package.json server/package-lock.json ./server/
COPY client/package.json client/package-lock.json ./client/
RUN cd server && npm ci
RUN cd client && npm ci
COPY server/ ./server/
COPY client/ ./client/
RUN cd server && npx prisma generate && npm run build && npx tsc prisma/seed.ts --outDir /tmp/seed --module commonjs --target ES2022 --esModuleInterop --skipLibCheck
ARG VITE_STRIPE_PUBLISHABLE_KEY
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_APPLE_CLIENT_ID
ENV VITE_STRIPE_PUBLISHABLE_KEY=$VITE_STRIPE_PUBLISHABLE_KEY \
    VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID \
    VITE_APPLE_CLIENT_ID=$VITE_APPLE_CLIENT_ID
RUN cd client && npm run build
# Retain the generated Prisma client and migration CLI, discard development test tools (Prisma retains its required peer dependencies).
RUN cd server && npm prune --omit=dev && npm cache clean --force

FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS production
WORKDIR /app
ARG VCS_REF=unknown
ENV NODE_ENV=production APP_REVISION=$VCS_REF
LABEL org.opencontainers.image.revision=$VCS_REF
# Apply available distribution security fixes and remove package managers from runtime.
RUN apk upgrade --no-cache && addgroup --system appgroup && adduser --system --ingroup appgroup appuser \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn* \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg
COPY --from=builder /app/server/node_modules ./node_modules
COPY --from=builder /app/server/dist ./dist
COPY --from=builder /app/server/package.json ./package.json
COPY --from=builder /app/server/prisma ./prisma
COPY --from=builder /app/server/prisma.config.ts ./prisma.config.ts
COPY --from=builder /tmp/seed/seed.js ./prisma/seed.js
COPY --from=builder /app/client/dist ./public
USER appuser
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=20s \
  CMD wget -qO- http://127.0.0.1:3000/health/ready || exit 1
ENTRYPOINT ["node"]
CMD ["dist/server.js"]
