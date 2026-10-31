import { buildApp } from './app.js';
import { env } from './config/env.js';
import { pool } from './db/pool.js';
import { closeEventPublisher } from './events/publisher.js';
import { runMigrations } from './startup/migrations.js';

const app = await buildApp();

async function shutdown(signal: string) {
  app.log.info({ signal }, 'Shutting down social-service');
  try {
    await app.close();
    await closeEventPublisher();
    await pool.end();
    process.exit(0);
  } catch (error) {
    app.log.error({ err: error }, 'Shutdown failed');
    process.exit(1);
  }
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

try {
  if (env.DB_MIGRATE_ON_START) await runMigrations();
  await app.listen({ host: env.HOST, port: env.PORT });
} catch (error) {
  app.log.error({ err: error }, 'Failed to start social-service');
  await app.close();
  await pool.end();
  process.exit(1);
}
