import { readFileSync } from 'fs';
import { resolve } from 'path';
import { execute } from './connection';
import { getLogger } from '../observability/logger';

const logger = getLogger('db-init');

/**
 * Initialize database schema
 */
export async function initializeDatabase(): Promise<void> {
  try {
    logger.info('Initializing database schema...');
    
    const schemaPath = resolve(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');
    
    // Split by semicolon and execute each statement
    const statements = schema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);
    
    for (const statement of statements) {
      await execute(statement);
    }
    
    logger.info('✅ Database schema initialized successfully');
  } catch (error) {
    logger.error({ error }, 'Failed to initialize database schema');
    throw error;
  }
}
