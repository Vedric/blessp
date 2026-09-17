const fs = require('node:fs'); const path = require('node:path'); const { spawnSync } = require('node:child_process'); const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'blessp-legacy-migration-'));
if (process.env.NODE_ENV !== 'test') throw new Error('Run through scripts/test-env.cjs.');
// migrate deploy reads the historical migration files; it does not push schema.prisma.
fs.copyFileSync(path.join(root, 'server/prisma/schema.prisma'), path.join(temp, 'schema.prisma'));
for (const name of ['00000000000000_init', '20260415172448_add_mfa_backup_codes', '20260713154935_add_shipping_and_billing_to_orders', 'migration_lock.toml']) fs.cpSync(path.join(root, 'server/prisma/migrations', name), path.join(temp, 'migrations', name), { recursive: true });
const database = new URL(process.env.DATABASE_URL); assert.match(database.pathname, /_(test|audit|ci)$/);
const schemaName = 'legacy_check_' + require('node:crypto').randomUUID().replaceAll('-', '');
database.searchParams.set('schema', schemaName); process.env.DATABASE_URL = database.toString();
function migrate(schema) { const result = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy', '--schema', schema], { cwd: path.join(root, 'server'), env: process.env, stdio: 'inherit' }); assert.equal(result.status, 0); }
migrate(path.join(temp, 'schema.prisma'));
const { PrismaClient } = require(root + '/server/node_modules/@prisma/client'); const db = new PrismaClient();
(async () => {
 await db.$executeRawUnsafe(`INSERT INTO users(id,email,first_name,last_name,password_hash,updated_at) VALUES ('00000000-0000-4000-8000-000000000011','legacy@example.com','Legacy','Test','synthetic',now())`);
 await db.$executeRawUnsafe(`INSERT INTO products(id,name,price,updated_at) VALUES ('00000000-0000-4000-8000-000000000012','Legacy',1000,now())`);
 for (const [id, qty, size, color] of [['1',2,null,null],['2',3,null,null],['3',4,'','']]) await db.$executeRawUnsafe(`INSERT INTO cart_items(id,user_id,product_id,quantity,size,color) VALUES ($1,'00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000012',$2,$3,$4)`, id, qty, size, color);
 await db.$executeRawUnsafe(`INSERT INTO orders(id,user_id,order_number,total_cents,status,updated_at) VALUES ('00000000-0000-4000-8000-000000000013','00000000-0000-4000-8000-000000000011','BLP-LEGACY-PAID',1000,'shipped',now()),('00000000-0000-4000-8000-000000000014',NULL,'BLP-LEGACY-PENDING',1000,'pending',now())`);
 migrate(path.join(root, 'server/prisma/schema.prisma'));
 const cart = await db.cartItem.findMany(); assert.equal(cart.length, 1); assert.equal(cart[0].quantity, 9); assert.equal(cart[0].size, ''); assert.equal(cart[0].color, '');
 const shipped = await db.order.findUniqueOrThrow({ where: { id:'00000000-0000-4000-8000-000000000013' } }); assert.equal(shipped.status, 'shipped'); assert.equal(shipped.paymentStatus, 'paid');
 const pending = await db.order.findUniqueOrThrow({ where: { id:'00000000-0000-4000-8000-000000000014' } }); assert.equal(pending.expiresAt, null); assert.equal(pending.paymentStatus,'pending');
 const user = await db.user.findUniqueOrThrow({ where: { id:'00000000-0000-4000-8000-000000000011' } }); assert.equal(user.emailVerifiedAt, null);
 console.log(JSON.stringify({ result:'PASS', mergedQuantity:cart[0].quantity, financialBackfill:shipped.paymentStatus, legacyReservationExpiresAt:pending.expiresAt, verifiedEmail:user.emailVerifiedAt }));
})().catch(e=>{console.error(e.message);process.exitCode=1}).finally(async () => {
  // Only the unique schema created by this test is removed.
  await db.$executeRawUnsafe('DROP SCHEMA IF EXISTS "' + schemaName + '" CASCADE');
  await db.$disconnect();
  fs.rmSync(temp, { recursive: true, force: true });
});
