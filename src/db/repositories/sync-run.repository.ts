import { query, queryOne, execute } from '../connection';
import { getLogger } from '../../observability/logger';
import { v4 as uuidv4 } from 'uuid';

const logger = getLogger('sync-run-repository');

export interface SyncRun {
  id: string;
  correlationId: string;
  status: string;
  triggerType: string;
  requestedBy?: string;
  startedAt: Date;
  finishedAt?: Date;
  errorMessage?: string;
  summary?: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface SourceSyncRun {
  id: string;
  syncRunId: string;
  connectionId: string;
  source: string;
  mode: string;
  status: string;
  recordCount?: number;
  errorMessage?: string;
  startedAt: Date;
  finishedAt?: Date;
  createdAt: Date;
}

export class SyncRunRepository {
  /**
   * Create parent sync run
   */
  async createSyncRun(data: {
    triggerType: string;
    requestedBy?: string;
  }): Promise<SyncRun> {
    const id = uuidv4().replace(/-/g, '').substring(0, 24);
    const correlationId = `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    await execute(
      `INSERT INTO sync_runs (id, correlation_id, status, trigger_type, requested_by, started_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, correlationId, 'RUNNING', data.triggerType, data.requestedBy || null, now, now, now]
    );

    return {
      id,
      correlationId,
      status: 'RUNNING',
      triggerType: data.triggerType,
      requestedBy: data.requestedBy,
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Create child source sync run
   */
  async createSourceSyncRun(data: {
    syncRunId: string;
    connectionId: string;
    source: string;
    mode: string;
  }): Promise<SourceSyncRun> {
    const id = uuidv4().replace(/-/g, '').substring(0, 24);
    const now = new Date();

    await execute(
      `INSERT INTO source_sync_runs (id, sync_run_id, connection_id, source, mode, status, started_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, data.syncRunId, data.connectionId, data.source, data.mode, 'RUNNING', now, now]
    );

    return {
      id,
      syncRunId: data.syncRunId,
      connectionId: data.connectionId,
      source: data.source,
      mode: data.mode,
      status: 'RUNNING',
      startedAt: now,
      createdAt: now,
    };
  }

  /**
   * Update source sync run status
   */
  async updateSourceSyncRun(
    runId: string,
    data: {
      status?: string;
      recordCount?: number;
      errorMessage?: string;
      finishedAt?: Date;
    }
  ): Promise<SourceSyncRun> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (data.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      params.push(data.status);
    }
    if (data.recordCount !== undefined) {
      updates.push(`record_count = $${paramIndex++}`);
      params.push(data.recordCount);
    }
    if (data.errorMessage !== undefined) {
      updates.push(`error_message = $${paramIndex++}`);
      params.push(data.errorMessage);
    }
    if (data.finishedAt !== undefined) {
      updates.push(`finished_at = $${paramIndex++}`);
      params.push(data.finishedAt);
    }

    params.push(runId);

    await execute(
      `UPDATE source_sync_runs SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      params
    );

    const result = await queryOne<SourceSyncRun>(
      `SELECT * FROM source_sync_runs WHERE id = $1`,
      [runId]
    );

    return result!;
  }

  /**
   * Get source sync run
   */
  async getSourceSyncRun(runId: string): Promise<SourceSyncRun | null> {
    return queryOne<SourceSyncRun>(
      `SELECT * FROM source_sync_runs WHERE id = $1`,
      [runId]
    );
  }

  /**
   * Get all source runs for a parent sync
   */
  async getSyncRunSources(syncRunId: string): Promise<SourceSyncRun[]> {
    return query<SourceSyncRun>(
      `SELECT * FROM source_sync_runs WHERE sync_run_id = $1 ORDER BY created_at`,
      [syncRunId]
    );
  }

  /**
   * Finalize parent sync run
   */
  async finalizeSyncRun(
    syncRunId: string,
    sources: SourceSyncRun[]
  ): Promise<SyncRun> {
    const allSuccess = sources.every((s) => s.status === 'SUCCESS');
    const anySuccess = sources.some((s) => s.status === 'SUCCESS');

    let status: string;
    if (allSuccess) {
      status = 'SUCCESS';
    } else if (anySuccess) {
      status = 'PARTIAL_SUCCESS';
    } else {
      status = 'FAILED';
    }

    const summary = {
      sources: sources.map((s) => ({
        source: s.source,
        status: s.status,
        recordCount: s.recordCount,
        errorMessage: s.errorMessage,
      })),
    };

    const now = new Date();

    await execute(
      `UPDATE sync_runs SET status = $1, finished_at = $2, summary = $3, updated_at = $4 WHERE id = $5`,
      [status, now, JSON.stringify(summary), now, syncRunId]
    );

    return (await queryOne<SyncRun>(
      `SELECT * FROM sync_runs WHERE id = $1`,
      [syncRunId]
    ))!;
  }

  /**
   * Get sync run by ID
   */
  async getSyncRun(syncRunId: string): Promise<SyncRun | null> {
    return queryOne<SyncRun>(
      `SELECT * FROM sync_runs WHERE id = $1`,
      [syncRunId]
    );
  }

  /**
   * Get recent sync runs
   */
  async getRecentSyncRuns(limit: number = 20): Promise<SyncRun[]> {
    return query<SyncRun>(
      `SELECT * FROM sync_runs ORDER BY started_at DESC LIMIT $1`,
      [limit]
    );
  }
}

export const syncRunRepository = new SyncRunRepository();
