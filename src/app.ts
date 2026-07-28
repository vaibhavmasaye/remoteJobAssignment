import Fastify from 'fastify';
import { getConfig } from './config/env';
import { getLogger } from './observability/logger';
import { prisma } from './db/prisma';

const config = getConfig();
const logger = getLogger('app');

export async function createApp() {
  const fastify = Fastify({
    logger: false, // We use pino directly
    trustProxy: config.TRUST_PROXY,
    bodyLimit: config.REQUEST_BODY_LIMIT_BYTES,
  });

  // Health check endpoint
  fastify.get('/health/live', async (_request, reply) => {
    return reply.code(200).send({ status: 'ok' });
  });

  // Readiness check endpoint
  fastify.get('/health/ready', async (_request, reply) => {
    try {
      if (config.HEALTH_CHECK_DATABASE) {
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

  // Graceful shutdown
  const signals = ['SIGTERM', 'SIGINT'];
  signals.forEach((signal) => {
    process.on(signal, async () => {
      logger.info(`Received ${signal}, gracefully shutting down...`);
      await fastify.close();
      await prisma.$disconnect();
      process.exit(0);
    });
  });

  return fastify;
}
