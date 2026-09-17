// Exercise optimized production assets without inheriting real provider keys
// from the shell or client/.env. NODE_ENV=test would enable Vite's dev-only UI.
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const providers = process.argv.includes('--providers');
const result = spawnSync('npm', ['run', 'build'], {
  cwd: path.resolve(__dirname, '..'),
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production',
    VITE_STRIPE_PUBLISHABLE_KEY: '',
    VITE_GOOGLE_CLIENT_ID: providers ? 'isolated-google-client' : '',
    VITE_APPLE_CLIENT_ID: providers ? 'isolated-apple-client' : '',
  },
});
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
