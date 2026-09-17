const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = '/home/vedric/projets/fullstack/blessp';
const image = 'blessp:launch-audit-20260917';
const suffix = crypto.randomBytes(4).toString('hex');
const network = 'blessp-launch-smoke-' + suffix;
const container = network + '-app';
const schema = 'launch_smoke_' + suffix;
const databaseContainer = 'blessp-browser-20260916-db';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'blessp-launch-smoke-'));
const report = { image, checks: {} };
const run = (args, check = true) => {
  const result = spawnSync('docker', args, { encoding: 'utf8', timeout: 120000 });
  if (check && result.status !== 0) throw Error('Docker operation failed: ' + args.slice(0, 2).join(' ') + '\n' + result.stderr);
  return result;
};
let connected = false, networkCreated = false, started = false;
const http = async (pathname, headers = {}) => {
  const script = 'fetch("http://127.0.0.1:3000"+process.argv[1],{headers:JSON.parse(process.argv[2]),signal:AbortSignal.timeout(3000)}).then(async r=>console.log(JSON.stringify({body:await r.text(),status:r.status,headers:Object.fromEntries(r.headers)}))).catch(()=>process.exit(1))';
  const response = JSON.parse(run(['exec', container, 'node', '-e', script, pathname, JSON.stringify(headers)]).stdout);
  return new Response(response.body, { status: response.status, headers: response.headers });
};
(async () => {
  const keys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
  const env = { NODE_ENV: 'production', DATABASE_URL: `postgresql://audit:audit_local_only@launch-db:5432/blessp_audit?schema=${schema}`, JWT_PRIVATE_KEY_BASE64: Buffer.from(keys.privateKey).toString('base64'), JWT_PUBLIC_KEY_BASE64: Buffer.from(keys.publicKey).toString('base64'), MFA_ENCRYPTION_KEY: crypto.randomBytes(32).toString('base64'), METRICS_TOKEN: crypto.randomBytes(32).toString('hex'), CLIENT_URL: 'https://smoke.example.invalid', CORS_ALLOWED_ORIGINS: 'https://smoke.example.invalid', SUPPORT_EMAIL: 'support@example.invalid', EMAIL_FROM: 'orders@example.invalid', SHIPPING_RATES_JSON: JSON.stringify([{ country: 'CA', feeCents: 750, freeThresholdCents: null }]), STRIPE_SECRET_KEY: 'sk_test_isolated_placeholder', STRIPE_WEBHOOK_SECRET: 'whsec_isolated_placeholder', RESEND_API_KEY: 'synthetic-not-a-provider-key', OTEL_ENABLED: 'false', LOG_LEVEL: 'error', PORT: '3000' };
  const envFile = path.join(dir, 'synthetic.env');
  fs.writeFileSync(envFile, Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n'), { mode: 0o600 });
  const invalidFile = path.join(dir, 'missing-config.env');
  fs.writeFileSync(invalidFile, Object.entries(env).filter(([k]) => !['SUPPORT_EMAIL', 'SHIPPING_RATES_JSON'].includes(k)).map(([k, v]) => `${k}=${v}`).join('\n'), { mode: 0o600 });
  const invalid = run(['run', '--rm', '--network', 'none', '--env-file', invalidFile, image], false);
  report.checks.missingCommerceConfigurationRejected = invalid.status !== 0 && invalid.stderr.includes('SUPPORT_EMAIL') && invalid.stderr.includes('SHIPPING_RATES_JSON');
  run(['network', 'create', '--internal', network]); networkCreated = true;
  report.checks.externalNetworkDisabled = JSON.parse(run(['network', 'inspect', network]).stdout)[0].Internal === true;
  run(['network', 'connect', '--alias', 'launch-db', network, databaseContainer]); connected = true;
  const migration = run(['run', '--rm', '--network', network, '--env-file', envFile, image, 'node_modules/prisma/build/index.js', 'migrate', 'deploy']);
  fs.writeFileSync(path.join(root, 'artifacts/launch-20260917/docker-migrations.log'), migration.stdout + migration.stderr);
  report.checks.migrationsApplied = migration.stdout.includes('All migrations have been successfully applied');
  run(['run', '-d', '--name', container, '--network', network, '--env-file', envFile, image]); started = true;
  let health;
  for (let i = 0; i < 30; i++) {
    try { const response = await http('/health/ready'); if (response.ok) { health = await response.json(); break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!health) throw Error('Image did not become ready');
  report.checks.readyRevision = health.status === 'ready' && health.revision === 'launch-local-audit-20260917';
  const configuration = await http('/api/v1/commerce/config'); const payload = await configuration.json();
  report.checks.explicitShippingRates = JSON.stringify(payload.data) === JSON.stringify({ currency: 'CAD', shippingRates: [{ country: 'CA', feeCents: 750, freeThresholdCents: null }] }) && configuration.headers.get('cache-control') === 'no-store';
  report.checks.privateAdminDocumentsRecognized = (await http('/admin/contact')).status === 200 && (await http('/admin/inventory')).status === 200;
  report.checks.supportRequiresAuthentication = (await http('/api/v1/admin/contact')).status === 401;
  const home = await http('/'); const html = await home.text();
  const entry = html.match(/src="(\/assets\/index-[^"]+\.js)"/)?.[1];
  report.checks.storefrontAndAssetServed = home.ok && !!entry && (await http(entry)).ok;
  report.checks.nonRootRuntime = run(['exec', container, 'id', '-u']).stdout.trim() !== '0';
  const metrics = await http('/metrics', { Authorization: 'Bearer ' + env.METRICS_TOKEN });
  report.checks.authenticatedMetrics = metrics.ok && (await metrics.text()).includes('http_requests_total');
  run(['stop', '--time', '15', container]);
  report.checks.cleanShutdown = JSON.parse(run(['inspect', container]).stdout)[0].State.ExitCode === 0;
  const logs = run(['logs', container]); fs.writeFileSync(path.join(root, 'artifacts/launch-20260917/docker-runtime.log'), logs.stdout + logs.stderr);
  report.passed = Object.values(report.checks).every(Boolean);
  fs.writeFileSync(path.join(root, 'artifacts/launch-20260917/docker-smoke.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => {
  if (started) { const logs = run(['logs', container], false); fs.writeFileSync(path.join(root, 'artifacts/launch-20260917/docker-runtime.log'), logs.stdout + logs.stderr); run(['rm', '-f', container], false); }
  run(['exec', databaseContainer, 'psql', '-U', 'audit', '-d', 'blessp_audit', '-c', `DROP SCHEMA IF EXISTS ${schema} CASCADE`], false);
  if (connected) run(['network', 'disconnect', network, databaseContainer], false);
  if (networkCreated) run(['network', 'rm', network], false);
  fs.rmSync(dir, { recursive: true, force: true });
});
