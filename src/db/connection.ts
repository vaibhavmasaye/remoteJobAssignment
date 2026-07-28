import { PrismaClient } from '@prisma/client';
import { getLogger } from '../observability/logger';

const logger = getLogger('db-connection');
export const prisma = new PrismaClient();

/**
 * Check database connectivity
 */
export async function checkConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error({ error }, 'Database connection check failed');
    return false;
  }
}

/**
 * Close the pool
 */
export async function closePool(): Promise<void> {
  await prisma.$disconnect();
  logger.info('Prisma client disconnected');
}

export default prisma;
