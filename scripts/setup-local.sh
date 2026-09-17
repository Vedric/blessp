#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
for executable in node npm docker; do
  command -v "$executable" >/dev/null || { echo "Missing prerequisite: $executable" >&2; exit 1; }
done
if [[ "${1:-}" != "" && "${1:-}" != "--seed" ]]; then
  echo "Usage: scripts/setup-local.sh [--seed]" >&2
  exit 1
fi
npm ci
npm --prefix server ci
npm --prefix client ci
node scripts/configure-local.cjs
docker compose -f docker-compose.dev.yml up -d --wait db redis
(
  cd server
  npx --no-install prisma generate
  npx --no-install prisma migrate deploy
  # Existing databases are never reset, pushed or seeded implicitly.
  if [[ "${1:-}" == "--seed" ]]; then npm run db:seed; fi
)
npm run lint
npm run build
npm test -- --runInBand
echo 'Setup complete. Start with npm run dev. Use --seed explicitly to install demo data.'
echo 'Integration/E2E tests require a separate database ending in _test, _audit or _ci.'
