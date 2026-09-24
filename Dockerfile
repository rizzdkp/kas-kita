FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production TZ=Asia/Jakarta NEXT_TELEMETRY_DISABLED=1
RUN addgroup -S app && adduser -S app -G app && mkdir -p /data/attachments && chown app:app /data/attachments
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/drizzle ./drizzle
# skrip CLI (migrasi, buat user) dijalankan dengan tsx langsung dari sumber
COPY --from=build --chown=app:app /app/scripts ./scripts
COPY --from=build --chown=app:app /app/src ./src
COPY --from=build --chown=app:app /app/tsconfig.json ./tsconfig.json
COPY --from=deps --chown=app:app /app/node_modules ./node_modules
USER app
EXPOSE 3000
CMD ["node", "server.js"]
