import { Pool, PoolClient } from 'pg';
import { getConfig } from '../config/env';
import { getLogger } from '../observability/logger';

const logger = getLogger('db-connection');
const config = getConfig();

// Create connection pool
const pool = new Pool({
  connectionString: config.DATABASE_URL,
  max: config.DB_CONNECTION_LIMIT,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: config.DB_CONNECT_TIMEOUT_SECONDS * 1000,
  ssl: config.DB_SSL ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  logger.error({ error: err }, 'Unexpected error on idle client');
});

/**
 * Get a client from the pool
 */
export async function getClient(): Promise<PoolClient> {
  try {
    const client = await pool.connect();
    return client;
  } catch (error) {
    logger.error({ error }, 'Failed to get database client');
    throw error;
  }
}

/**
 * Execute a query and return all rows
 */
export async function query<T = any>(
  sql: string,
  params?: (string | number | boolean | null | Date)[]
): Promise<T[]> {
  const client = await getClient();
  try {
    const result = await client.query(sql, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

/**
 * Execute a query and return single row
 */
export async function queryOne<T = any>(
  sql: string,
  params?: (string | number | boolean | null | Date)[]
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Execute a query that modifies data
 */
export async function execute(
  sql: string,
  params?: (string | number | boolean | null | Date)[]
): Promise<number> {
  const client = await getClient();
  try {
    const result = await client.query(sql, params);
    return result.rowCount || 0;
  } finally {
    client.release();
  }
}

/**
 * Check database connectivity
 */
export async function checkConnection(): Promise<boolean> {
  try {
    const client = await getClient();
    try {
      await client.query('SELECT 1');
      return true;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error({ error }, 'Database connection check failed');
    return false;
  }
}

/**
 * Close the pool
 */
export async function closePool(): Promise<void> {
  await pool.end();
  logger.info('Database pool closed');
}

export default pool;
