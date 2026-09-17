const path = require('node:path');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const root = path.resolve(__dirname, '..');
const url = new URL(process.env.DATABASE_URL || '');
if (process.env.NODE_ENV !== 'test' || !/_(test|audit|ci)$/.test(url.pathname)) throw new Error('Run Playwright through scripts/test-env.cjs with a test database.');
url.searchParams.set('schema', 'e2e');
process.env.DATABASE_URL = url.toString();
const serverDir = path.join(root, 'server');
for (const args of [['node_modules/prisma/build/index.js', 'migrate', 'deploy'], ['node_modules/tsx/dist/cli.mjs', 'prisma/seed.ts']]) {
  const result = spawnSync(process.execPath, args, { cwd: serverDir, env: process.env, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
process.env.STATIC_DIR = path.join(root, 'client/dist');
// The E2E process deliberately runs no outbound mail worker. Browser tests can
// confirm synthetic email links by reading their own isolated outbox rows.
const { createApp } = require('../server/dist/app');
const { prisma } = require('../server/dist/core/database/client');
const app = require('../server/node_modules/express')();
if (process.env.E2E_SIMULATE_PROVIDERS === '1') require('./provider-fixtures.cjs')(app);
app.use(createApp());
const server = app.listen(3107, '127.0.0.1');
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(async () => { await prisma.$disconnect(); process.exit(0); }));
