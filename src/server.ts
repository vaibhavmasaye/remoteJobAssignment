import { getConfig } from './config/env';
import { getLogger } from './observability/logger';
import { createApp } from './app';

const logger = getLogger('server');

async function start() {
  try {
    logger.info('Loading configuration...');
    const config = getConfig();
    
    logger.info(
      {
        port: config.PORT,
        env: config.NODE_ENV,
        trustProxy: config.TRUST_PROXY,
      },
      'Starting sync pipeline service'
    );

    logger.info('Creating application...');
    const app = await createApp();
    
    logger.info(`Binding to 0.0.0.0:${config.PORT}...`);
    await app.listen({ port: config.PORT, host: '0.0.0.0' });

    logger.info({ port: config.PORT }, '✅ Server listening successfully');
  } catch (error) {
    const errorInfo = error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      name: error.name,
    } : error;
    
    logger.error({ error: errorInfo }, '❌ Failed to start server');
    
    // Log which step failed based on error type
    if (error instanceof Error) {
      if (error.message.includes('EADDRINUSE')) {
        logger.error('Port is already in use');
      } else if (error.message.includes('validation')) {
        logger.error('Configuration validation failed - check environment variables');
      } else if (error.message.includes('database') || error.message.includes('prisma')) {
        logger.error('Database connection failed');
      }
    }
    
    process.exit(1);
  }
}

start();
