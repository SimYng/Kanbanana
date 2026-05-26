#!/bin/sh
set -e

# 兼容从 0.1.x（StackBoard）升级：若发现旧版数据库文件，自动重命名为新品牌路径
if [ -f /app/data/stack-board.db ] && [ ! -f /app/data/kanbanana.db ]; then
  echo "[entrypoint] migrating legacy stack-board.db -> kanbanana.db"
  mv /app/data/stack-board.db /app/data/kanbanana.db
  if [ -f /app/data/stack-board.db-journal ]; then
    mv /app/data/stack-board.db-journal /app/data/kanbanana.db-journal
  fi
fi

echo "[entrypoint] applying database migrations..."
./node_modules/.bin/prisma migrate deploy --schema=prisma/schema.prisma

if [ "${RUN_SEED:-true}" = "true" ]; then
  echo "[entrypoint] seeding (skips if data exists)..."
  ./node_modules/.bin/tsx prisma/seed.ts || echo "[entrypoint] seed skipped or already populated"
fi

echo "[entrypoint] starting Next.js server..."
exec "$@"
