import { query, queryOne, execute } from '../connection';
import { v4 as uuidv4 } from 'uuid';

export interface SyncCheckpoint {
  id: string;
  connectionId: string;
  objectType: string;
  cursor?: string;
  watermark?: Date;
  cursorVersion: number;
  lastFullSyncAt?: Date;
  lastIncrementalSyncAt?: Date;
  updatedAt: Date;
}

export class CheckpointRepository {
  /**
   * Get or create checkpoint
   */
  async getOrCreateCheckpoint(data: {
    connectionId: string;
    objectType: string;
  }): Promise<SyncCheckpoint> {
    let checkpoint = await queryOne<SyncCheckpoint>(
      `SELECT * FROM sync_checkpoints WHERE connection_id = $1 AND object_type = $2`,
      [data.connectionId, data.objectType]
    );

    if (!checkpoint) {
      const id = uuidv4().replace(/-/g, '').substring(0, 24);
      const now = new Date();

      await execute(
        `INSERT INTO sync_checkpoints (id, connection_id, object_type, cursor_version, updated_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, data.connectionId, data.objectType, 1, now]
      );

      checkpoint = (await queryOne<SyncCheckpoint>(
        `SELECT * FROM sync_checkpoints WHERE id = $1`,
        [id]
      ))!;
    }

    return checkpoint;
  }

  /**
   * Update checkpoint
   */
  async updateCheckpoint(
    connectionId: string,
    objectType: string,
    data: {
      cursor?: string;
      watermark?: Date;
      cursorVersion?: number;
      lastFullSyncAt?: Date;
      lastIncrementalSyncAt?: Date;
    }
  ): Promise<SyncCheckpoint> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (data.cursor !== undefined) {
      updates.push(`cursor = $${paramIndex++}`);
      params.push(data.cursor);
    }
    if (data.watermark !== undefined) {
      updates.push(`watermark = $${paramIndex++}`);
      params.push(data.watermark);
    }
    if (data.cursorVersion !== undefined) {
      updates.push(`cursor_version = $${paramIndex++}`);
      params.push(data.cursorVersion);
    }
    if (data.lastFullSyncAt !== undefined) {
      updates.push(`last_full_sync_at = $${paramIndex++}`);
      params.push(data.lastFullSyncAt);
    }
    if (data.lastIncrementalSyncAt !== undefined) {
      updates.push(`last_incremental_sync_at = $${paramIndex++}`);
      params.push(data.lastIncrementalSyncAt);
    }

    updates.push(`updated_at = $${paramIndex++}`);
    params.push(new Date());

    params.push(connectionId);
    params.push(objectType);

    await execute(
      `UPDATE sync_checkpoints SET ${updates.join(', ')} WHERE connection_id = $${paramIndex++} AND object_type = $${paramIndex}`,
      params
    );

    return (await queryOne<SyncCheckpoint>(
      `SELECT * FROM sync_checkpoints WHERE connection_id = $1 AND object_type = $2`,
      [connectionId, objectType]
    ))!;
  }

  /**
   * Advance checkpoint (mark as synced)
   */
  async advanceCheckpoint(
    connectionId: string,
    objectType: string,
    data: {
      cursor?: string;
      watermark?: Date;
    }
  ): Promise<SyncCheckpoint> {
    return this.updateCheckpoint(connectionId, objectType, {
      ...data,
      lastIncrementalSyncAt: new Date(),
    });
  }

  /**
   * Clear checkpoint (reset for full sync)
   */
  async clearCheckpoint(connectionId: string, objectType: string): Promise<void> {
    await execute(
      `UPDATE sync_checkpoints SET cursor = NULL, watermark = NULL, cursor_version = cursor_version + 1, updated_at = NOW() WHERE connection_id = $1 AND object_type = $2`,
      [connectionId, objectType]
    );
  }
}

export const checkpointRepository = new CheckpointRepository();
