import { query, queryOne, execute } from '../connection';
import { v4 as uuidv4 } from 'uuid';

export interface ExternalRecord {
  id: string;
  connectionId: string;
  objectType: string;
  externalId: string;
  data: any;
  syncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class ExternalRecordRepository {
  /**
   * Create or update external record
   */
  async upsertRecord(data: {
    connectionId: string;
    objectType: string;
    externalId: string;
    data: any;
  }): Promise<ExternalRecord> {
    const id = uuidv4().replace(/-/g, '').substring(0, 24);
    const now = new Date();

    try {
      await execute(
        `INSERT INTO external_records (id, connection_id, object_type, external_id, data, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (connection_id, object_type, external_id) DO UPDATE
         SET data = $5, updated_at = $7`,
        [id, data.connectionId, data.objectType, data.externalId, JSON.stringify(data.data), now, now]
      );
    } catch (error) {
      // Update if insert failed (conflict)
      await execute(
        `UPDATE external_records SET data = $1, updated_at = $2 
         WHERE connection_id = $3 AND object_type = $4 AND external_id = $5`,
        [JSON.stringify(data.data), now, data.connectionId, data.objectType, data.externalId]
      );
    }

    return (await queryOne<ExternalRecord>(
      `SELECT * FROM external_records WHERE connection_id = $1 AND object_type = $2 AND external_id = $3`,
      [data.connectionId, data.objectType, data.externalId]
    ))!;
  }

  /**
   * Get records needing sync
   */
  async getRecordsNeedingSync(connectionId: string): Promise<ExternalRecord[]> {
    return query<ExternalRecord>(
      `SELECT * FROM external_records WHERE connection_id = $1 AND (synced_at IS NULL OR updated_at > synced_at)
       ORDER BY updated_at LIMIT 1000`,
      [connectionId]
    );
  }

  /**
   * Get a specific external record
   */
  async getExternalRecord(
    connectionId: string,
    objectType: string,
    externalId: string
  ): Promise<ExternalRecord | null> {
    return queryOne<ExternalRecord>(
      `SELECT * FROM external_records WHERE connection_id = $1 AND object_type = $2 AND external_id = $3`,
      [connectionId, objectType, externalId]
    );
  }

  /**
   * Mark records as synced
   */
  async markRecordsSynced(recordIds: string[]): Promise<void> {
    if (recordIds.length === 0) return;

    const placeholders = recordIds.map((_, i) => `$${i + 1}`).join(',');
    await execute(
      `UPDATE external_records SET synced_at = NOW() WHERE id IN (${placeholders})`,
      recordIds
    );
  }
}

export const externalRecordRepository = new ExternalRecordRepository();
