import { getConfig } from './config/env';
import { getLogger } from './observability/logger';
import { createApp } from './app';

// Log immediately to stdout (bypassing pino for startup issues)
console.log('[SERVER] Starting initialization...');
console.log(`[SERVER] NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`[SERVER] PORT: ${process.env.PORT}`);
console.log(`[SERVER] Database configured: ${process.env.DATABASE_URL ? 'YES' : 'NO'}`);
console.log(`[SERVER] Admin API Key configured: ${process.env.ADMIN_API_KEY ? 'YES' : 'NO'}`);

async function start() {
  try {
    console.log('[SERVER] Loading configuration...');
    const config = getConfig();
    
    const logger = getLogger('server');
    
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
    console.log('[SERVER] ✅ Server is running');
  } catch (error) {
    // Log to console FIRST to ensure we see it
    console.error('[SERVER] ❌ FATAL ERROR:', error);
    
    const errorInfo = error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      name: error.name,
    } : error;
    
    try {
      const logger = getLogger('server');
      logger.error({ error: errorInfo }, '❌ Failed to start server');
      
      // Log which step failed based on error type
      if (error instanceof Error) {
        if (error.message.includes('EADDRINUSE')) {
          logger.error('Port is already in use');
          console.error('[SERVER] Error: Port is already in use');
        } else if (error.message.includes('validation')) {
          logger.error('Configuration validation failed - check environment variables');
          console.error('[SERVER] Error: Configuration validation failed');
        } else if (error.message.includes('database') || error.message.includes('prisma')) {
          logger.error('Database connection failed');
          console.error('[SERVER] Error: Database connection failed');
        }
      }
    } catch (logError) {
      console.error('[SERVER] Could not write to logger:', logError);
    }
    
    process.exit(1);
  }
}

start();
