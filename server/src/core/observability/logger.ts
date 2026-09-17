import pino from 'pino';
import { trace, context } from '@opentelemetry/api';

const isProduction = process.env.NODE_ENV === 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: {
    service: process.env.SERVICE_NAME ?? 'blessp-api',
    version: process.env.SERVICE_VERSION ?? '3.0.0',
    env: process.env.NODE_ENV ?? 'development',
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["set-cookie"]',
      'password', 'token', 'refreshToken', 'accessToken', 'idToken', 'mfaToken', 'secret', 'resetUrl', 'resetToken', 'html', 'err.body',
      '*.resetUrl', '*.html', '*.body',
      '*.password',
      '*.passwordHash',
      '*.password_hash',
      '*.token',
      '*.refreshToken',
      '*.accessToken',
      '*.idToken',
      '*.mfaToken',
      '*.secret',
      '*.clientSecret',
      '*.apiKey',
      '*.resetToken',
      '*.paymentMethodId',
      '*.stripeCustomerId',
      '*.stripe_customer_id',
      '*.transactionKey',
      '*.cardNumber',
      '*.cvv',
      '*.cvc',
      '*.ssn',
    ],
    censor: '[REDACTED]',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  mixin() {
    const span = trace.getSpan(context.active());
    if (!span) {
      return {};
    }
    const spanContext = span.spanContext();
    return {
      traceId: spanContext.traceId,
      spanId: spanContext.spanId,
    };
  },
  transport: isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
});
