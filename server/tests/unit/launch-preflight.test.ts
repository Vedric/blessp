import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const repository = path.resolve(__dirname, '../../..');
let temp: string;
beforeEach(() => {
  temp = fs.mkdtempSync(path.join(os.tmpdir(), 'blessp-launch-check-'));
  for (const dir of ['scripts', 'config', 'client/src/i18n/locales']) fs.mkdirSync(path.join(temp, dir), { recursive: true });
  fs.copyFileSync(path.join(repository, 'scripts/check-launch.cjs'), path.join(temp, 'scripts/check-launch.cjs'));
  fs.copyFileSync(path.join(repository, 'config/launch.example.json'), path.join(temp, 'config/launch.example.json'));
  for (const lang of ['fr', 'en']) fs.writeFileSync(path.join(temp, `client/src/i18n/locales/${lang}.json`), '{}');
});
afterEach(() => fs.rmSync(temp, { recursive: true, force: true }));
function run(extra: string[] = []) {
  const result = spawnSync(process.execPath, [path.join(temp, 'scripts/check-launch.cjs'), ...extra], { encoding: 'utf8', env: { PATH: process.env.PATH, STRIPE_SECRET_KEY: 'super-secret-value-never-print', SUPPORT_EMAIL: 'private-support@example.com' } });
  return { code: result.status, output: result.stdout, data: JSON.parse(result.stdout) };
}
function reviewed() {
  const config = JSON.parse(fs.readFileSync(path.join(temp, 'config/launch.example.json'), 'utf8'));
  for (const field of Object.keys(config.company)) config.company[field] = 'Synthetic review';
  config.publicUrl = 'https://shop.blessp.ca';
  for (const item of Object.keys(config.reviews)) config.reviews[item] = true;
  fs.writeFileSync(path.join(temp, 'config/launch.json'), JSON.stringify(config));
}
it('blocks a release until a launch review is actually present', () => {
  const result = run(['--static']); expect(result.code).toBe(1); expect(result.data.ready).toBe(false); expect(result.data.blockers.join(' ')).toContain('launch.json');
});
it('does not mistake a repository review for working provider configuration', () => {
  reviewed(); expect(run(['--static']).code).toBe(0);
  const full = run(); expect(full.code).toBe(1); expect(full.data.ready).toBe(false);
  expect(full.output).not.toContain('super-secret-value-never-print'); expect(full.output).not.toContain('private-support@example.com');
});
it('rejects unfinished public legal content even with review flags set', () => {
  reviewed(); fs.writeFileSync(path.join(temp, 'client/src/i18n/locales/fr.json'), JSON.stringify({ company: '[À compléter]' }));
  const result = run(['--static']); expect(result.code).toBe(1); expect(result.data.blockers.join(' ')).toContain('Unfinished public legal');
});
it('does not accept missing review items or a placeholder public domain', () => {
  reviewed(); const file = path.join(temp, 'config/launch.json'); const config = JSON.parse(fs.readFileSync(file, 'utf8'));
  delete config.reviews.backupRestorationTested; config.publicUrl = 'https://shop.example.com'; fs.writeFileSync(file, JSON.stringify(config));
  const result = run(['--static']); expect(result.code).toBe(1); expect(result.data.blockers.join(' ')).toContain('backupRestorationTested'); expect(result.data.blockers.join(' ')).toContain('publicUrl');
});
