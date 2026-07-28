import Fastify from 'fastify';
import { getConfig } from './config/env';
import { getLogger } from './observability/logger';
import { prisma } from './db/prisma';
import { registerSyncRoutes } from './routes/sync.routes';
import {
  createRateLimiter,
  registerSecurityHeadersPlugin,
  registerErrorHandler,
  rateLimitHandler,
} from './middleware';

const config = getConfig();
const logger = getLogger('app');

export async function createApp() {
  logger.info('Creating Fastify app instance...');
  
  const fastify = Fastify({
    logger: false, // We use pino directly
    trustProxy: config.TRUST_PROXY,
    bodyLimit: config.REQUEST_BODY_LIMIT_BYTES,
    requestIdLogLabel: 'requestId',
    disableRequestLogging: false,
  });

  logger.info('Initializing rate limiter...');
  // Initialize rate limiter (100 requests per minute by default)
  createRateLimiter(60000, 100);

  logger.info('Registering error handler...');
  // Register global error handler
  await registerErrorHandler(fastify);

  logger.info('Registering security headers...');
  // Register security headers plugin
  await registerSecurityHeadersPlugin(fastify);

  logger.info('Adding rate limit hook...');
  // Apply rate limiter to all routes
  fastify.addHook('preHandler', rateLimitHandler);

  logger.info('Registering health check endpoints...');
  // Health check endpoint
  fastify.get('/health/live', async (_request, reply) => {
    return reply.code(200).send({ status: 'ok' });
  });

  // Readiness check endpoint
  fastify.get('/health/ready', async (_request, reply) => {
    try {
      if (config.HEALTH_CHECK_DATABASE) {
        logger.debug('Checking database connection...');
        await prisma.$queryRaw`SELECT 1`;
      }
      return reply.code(200).send({
        status: 'ready',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error({ error }, 'Readiness check failed');
      return reply.code(503).send({
        status: 'not_ready',
        error: 'Database connection failed',
      });
    }
  });

  // Status endpoint
  fastify.get('/api/v1/status', async (_request, reply) => {
    return reply.code(200).send({
      version: '1.0.0',
      environment: config.NODE_ENV,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // Swagger/OpenAPI endpoint (placeholder)
  fastify.get('/docs', async (_request, reply) => {
    return reply.code(200).send({
      openapi: '3.0.0',
      info: {
        title: 'Sync Pipeline API',
        version: '1.0.0',
      },
      paths: {
        '/health/live': {
          get: {
            summary: 'Liveness probe',
          },
        },
        '/health/ready': {
          get: {
            summary: 'Readiness probe',
          },
        },
        '/api/v1/status': {
          get: {
            summary: 'Service status',
          },
        },
      },
    });
  });

  logger.info('Registering sync routes...');
  // Register sync routes
  await registerSyncRoutes(fastify);

  logger.info('Setting up graceful shutdown handlers...');
  // Graceful shutdown
  const signals = ['SIGTERM', 'SIGINT'];
  signals.forEach((signal) => {
    process.on(signal, async () => {
      logger.info(`Received ${signal}, gracefully shutting down...`);
      
      // Import here to avoid circular dependency
      const { stopRateLimiter } = await import('./middleware');
      stopRateLimiter();
      
      await fastify.close();
      await prisma.$disconnect();
      process.exit(0);
    });
  });

  logger.info('✅ App created successfully');
  return fastify;
}
