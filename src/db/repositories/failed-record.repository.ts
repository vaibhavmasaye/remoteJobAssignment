import { query, queryOne, execute } from '../connection';
import { v4 as uuidv4 } from 'uuid';

export interface FailedRecord {
  id: string;
  connectionId: string;
  objectType: string;
  externalId?: string;
  errorMessage: string;
  errorStack?: string;
  retryCount: number;
  lastRetryAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class FailedRecordRepository {
  /**
   * Create failed record
   */
  async create(data: {
    connectionId: string;
    objectType: string;
    externalId?: string;
    errorMessage: string;
    errorStack?: string;
  }): Promise<FailedRecord> {
    const id = uuidv4().replace(/-/g, '').substring(0, 24);
    const now = new Date();

    await execute(
      `INSERT INTO failed_records (id, connection_id, object_type, external_id, error_message, error_stack, retry_count, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, data.connectionId, data.objectType, data.externalId || null, data.errorMessage, data.errorStack || null, 0, now, now]
    );

    return {
      id,
      connectionId: data.connectionId,
      objectType: data.objectType,
      externalId: data.externalId,
      errorMessage: data.errorMessage,
      errorStack: data.errorStack,
      retryCount: 0,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Get failed records for retry
   */
  async getFailedRecordsForRetry(connectionId: string, maxRetries: number = 5): Promise<FailedRecord[]> {
    return query<FailedRecord>(
      `SELECT * FROM failed_records WHERE connection_id = $1 AND retry_count < $2 ORDER BY last_retry_at NULLS FIRST LIMIT 100`,
      [connectionId, maxRetries]
    );
  }

  /**
   * Update retry count
   */
  async incrementRetryCount(recordId: string): Promise<void> {
    await execute(
      `UPDATE failed_records SET retry_count = retry_count + 1, last_retry_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [recordId]
    );
  }
}

export const failedRecordRepository = new FailedRecordRepository();
