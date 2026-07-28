import { getConfig } from './config/env';
import { getLogger } from './observability/logger';
import { createApp } from './app';

const config = getConfig();
const logger = getLogger('server');

async function start() {
  try {
    logger.info(
      { port: config.PORT, env: config.NODE_ENV },
      'Starting sync pipeline service'
    );

    const app = await createApp();
    await app.listen({ port: config.PORT, host: '0.0.0.0' });

    logger.info(`Server listening on http://0.0.0.0:${config.PORT}`);
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

start();
