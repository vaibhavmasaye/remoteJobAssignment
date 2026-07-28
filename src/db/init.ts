import { prisma } from './connection';
import { getLogger } from '../observability/logger';

const logger = getLogger('db-init');

/** Connect Prisma. Schema changes are applied with `npm run db:push`. */
export async function initializeDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('Prisma connected successfully');
  } catch (error) {
    logger.error({ error }, 'Prisma connection failed');
    throw error;
  }
}
