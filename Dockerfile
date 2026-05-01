FROM node:20-alpine AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3888

RUN apk add --no-cache git github-cli
RUN addgroup -S -g 1001 nextjs && adduser -S -u 1001 -G nextjs nextjs

COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/app ./app
COPY --from=builder /app/components ./components
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs /app/postcss.config.mjs /app/tailwind.config.ts /app/tsconfig.json ./
COPY --from=builder --chown=nextjs:nextjs /app/content ./content

RUN mkdir -p /app/content && chown -R nextjs:nextjs /app/content

USER nextjs
EXPOSE 3888
CMD ["pnpm", "start"]
