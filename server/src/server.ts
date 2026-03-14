// OpenTelemetry must be initialized before any other imports so that
// auto-instrumentation hooks into HTTP and Express modules at load time.
import { startTracer, shutdownTracer } from './core/observability/tracer';
startTracer();

import { createApp } from './app';
import { Env } from './core/config/env';
import { prisma, disconnectPrisma } from './core/database/client';
import { logger } from './core/observability/logger';

async function main(): Promise<void> {
  // Verify database connectivity before accepting traffic
  try {
    await prisma.$connect();
    logger.info('Database connection established');
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to connect to the database');
    process.exit(1);
  }

  const app = createApp();

  const server = app.listen(Env.PORT, () => {
    logger.info(
      { port: Env.PORT, env: Env.NODE_ENV },
      `${Env.SERVICE_NAME} v${Env.SERVICE_VERSION} listening on port ${Env.PORT}`,
    );
  });

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Shutdown signal received, closing server');

    server.close(async () => {
      logger.info('HTTP server closed');

      await disconnectPrisma();
      logger.info('Database connection closed');

      await shutdownTracer();
      logger.info('Tracer shut down');

      process.exit(0);
    });

    // Force exit if graceful shutdown takes too long
    setTimeout(() => {
      logger.error('Graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error) => {
  logger.fatal({ err: error }, 'Unrecoverable startup error');
  process.exit(1);
});
