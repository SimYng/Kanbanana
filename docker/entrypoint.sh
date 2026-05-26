#!/bin/sh
set -e

echo "[entrypoint] applying database migrations..."
./node_modules/.bin/prisma migrate deploy --schema=prisma/schema.prisma

if [ "${RUN_SEED:-true}" = "true" ]; then
  echo "[entrypoint] seeding (skips if data exists)..."
  ./node_modules/.bin/tsx prisma/seed.ts || echo "[entrypoint] seed skipped or already populated"
fi

echo "[entrypoint] starting Next.js server..."
exec "$@"
