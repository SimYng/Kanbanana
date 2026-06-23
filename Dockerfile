# =========================================================
# StackBoard 多阶段构建
# 最终镜像基于 Node alpine，包含编译后的 Next.js standalone 输出
# 数据库为 SQLite，文件挂载到 /app/data （由 docker-compose 提供 volume）
# =========================================================

FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

# ----- deps: 仅安装依赖 -----
FROM base AS deps
COPY package.json pnpm-lock.yaml* package-lock.json* yarn.lock* ./
RUN \
  if [ -f pnpm-lock.yaml ]; then \
    corepack enable pnpm && pnpm i --frozen-lockfile; \
  elif [ -f package-lock.json ]; then \
    npm ci; \
  elif [ -f yarn.lock ]; then \
    corepack enable && yarn --frozen-lockfile; \
  else \
    npm install; \
  fi

# ----- builder: 生成 Prisma + Next 构建 -----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_BUILD_STANDALONE=1
RUN npx prisma generate
RUN npm run build

# ----- runner: 运行时镜像 -----
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=2233
ENV HOSTNAME=0.0.0.0

# Next standalone 输出
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Prisma：CLI、schema、迁移文件
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json

# 给 seed.ts 用的 tsx + bcryptjs
COPY --from=builder /app/node_modules/tsx ./node_modules/tsx
COPY --from=builder /app/node_modules/.bin/tsx ./node_modules/.bin/tsx
COPY --from=builder /app/node_modules/bcryptjs ./node_modules/bcryptjs

# 启动脚本：先迁移 + seed，再启动 server
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

RUN mkdir -p /app/data && chown -R node:node /app
USER node

EXPOSE 2233
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "server.js"]
