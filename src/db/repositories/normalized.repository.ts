import { query, execute } from '../connection';
import { v4 as uuidv4 } from 'uuid';

export interface NormalizedRecord {
  id: string;
  source: string;
  entityType: string;
  entityData: any;
  externalRecordId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class NormalizedRepository {
  /**
   * Create normalized record
   */
  async create(data: {
    source: string;
    entityType: string;
    entityData: any;
    externalRecordId?: string;
  }): Promise<NormalizedRecord> {
    const id = uuidv4().replace(/-/g, '').substring(0, 24);
    const now = new Date();

    await execute(
      `INSERT INTO normalized_data (id, source, entity_type, entity_data, external_record_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        id,
        data.source,
        data.entityType,
        JSON.stringify(data.entityData),
        data.externalRecordId || null,
        now,
        now,
      ]
    );

    return {
      id,
      source: data.source,
      entityType: data.entityType,
      entityData: data.entityData,
      externalRecordId: data.externalRecordId,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Get records by source and type
   */
  async getBySourceAndType(source: string, entityType: string, limit: number = 1000): Promise<NormalizedRecord[]> {
    return query<NormalizedRecord>(
      `SELECT * FROM normalized_data WHERE source = $1 AND entity_type = $2 ORDER BY created_at DESC LIMIT $3`,
      [source, entityType, limit]
    );
  }
}

export const normalizedRepository = new NormalizedRepository();
