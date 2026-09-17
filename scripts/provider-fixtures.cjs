// Provider contracts simulated ONLY by the isolated browser test launcher.
// Never imported by application code or the production image.
const crypto = require('node:crypto');
module.exports = function installProviderFixtures(app) {
  const database = new URL(process.env.DATABASE_URL);
  if (process.env.NODE_ENV !== 'test' || !/_(test|audit|ci)$/.test(database.pathname) || database.searchParams.get('schema') !== 'e2e') throw new Error('Provider simulation requires the isolated E2E schema.');
  const { Env } = require('../server/dist/core/config/env');
  Env.PAYPAL_CLIENT_ID = 'synthetic'; Env.PAYPAL_CLIENT_SECRET = 'synthetic'; Env.PAYPAL_WEBHOOK_ID = 'synthetic'; Env.PAYPAL_ENVIRONMENT = 'sandbox';
  const { paypalGateway } = require('../server/dist/features/payments/paypal.gateway');
  const orders = new Map();
  paypalGateway.request = async (path, method, body) => {
    if (path === '/v2/checkout/orders' && method === 'POST') {
      const remote = { id: crypto.randomUUID(), status: 'CREATED', purchase_units: structuredClone(body.purchase_units) };
      remote.links = [{ rel: 'payer-action', href: `https://www.sandbox.paypal.com/checkoutnow?token=${remote.id}` }];
      orders.set(remote.id, remote); return structuredClone(remote);
    }
    const match = path.match(/^\/v2\/checkout\/orders\/([a-z0-9-]+)(\/capture)?$/);
    const remote = match && orders.get(match[1]);
    if (!remote) throw new Error('Unknown simulated PayPal order.');
    if (match[2]) {
      if (remote.status !== 'APPROVED') throw new Error('Simulated payment not approved.');
      remote.status = 'COMPLETED';
      remote.purchase_units[0].payments = { captures: [{ id: crypto.randomUUID(), status: 'COMPLETED', amount: structuredClone(remote.purchase_units[0].amount) }] };
    }
    return structuredClone(remote);
  };
  app.post('/__e2e/paypal/approve/:id', (req, res) => {
    const remote = orders.get(req.params.id);
    if (!remote) return res.sendStatus(404);
    remote.status = 'APPROVED'; res.sendStatus(204);
  });
  const { OAuthService } = require('../server/dist/features/auth/oauth.service');
  for (const provider of ['Google', 'Apple']) OAuthService.prototype[`verify${provider}Token`] = async token => {
    const match = /^fixture:([a-f0-9-]{36}):(named|profile)$/.exec(token);
    if (!match) throw new Error('Invalid simulated identity.');
    return { providerAccountId: match[1], email: `provider-${match[1]}@example.com`, ...(match[2] === 'named' ? { firstName: provider, lastName: 'Browser' } : {}) };
  };
};
