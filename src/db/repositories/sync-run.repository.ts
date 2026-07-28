import { prisma } from '../prisma';
import {
  SyncRun,
  SourceSyncRun,
  SyncRunStatus,
  SourceRunStatus,
  SyncTriggerType,
  SourceType,
  SyncMode,
} from '../../generated/prisma';

export class SyncRunRepository {
  /**
   * Create parent sync run
   */
  async createSyncRun(data: {
    triggerType: SyncTriggerType;
    requestedBy?: string;
  }): Promise<SyncRun> {
    return prisma.syncRun.create({
      data: {
        correlationId: `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        triggerType: data.triggerType,
        status: 'RUNNING',
        requestedBy: data.requestedBy,
      },
    });
  }

  /**
   * Create child source sync run
   */
  async createSourceSyncRun(data: {
    syncRunId: string;
    connectionId: string;
    source: SourceType;
    mode: SyncMode;
  }): Promise<SourceSyncRun> {
    return prisma.sourceSyncRun.create({
      data: {
        syncRunId: data.syncRunId,
        connectionId: data.connectionId,
        source: data.source,
        mode: data.mode,
        status: 'RUNNING',
      },
    });
  }

  /**
   * Update source sync run status and counts
   */
  async updateSourceSyncRun(
    runId: string,
    data: {
      status?: SourceRunStatus;
      recordsSeen?: number;
      recordsWritten?: number;
      recordsSkipped?: number;
      recordsFailed?: number;
      cursorAfter?: string;
      errorCode?: string;
      errorMessage?: string;
      finishedAt?: Date;
    }
  ): Promise<SourceSyncRun> {
    return prisma.sourceSyncRun.update({
      where: { id: runId },
      data,
    });
  }

  /**
   * Get source sync run
   */
  async getSourceSyncRun(runId: string): Promise<SourceSyncRun | null> {
    return prisma.sourceSyncRun.findUnique({
      where: { id: runId },
    });
  }

  /**
   * Get all source runs for a parent sync
   */
  async getSyncRunSources(syncRunId: string): Promise<SourceSyncRun[]> {
    return prisma.sourceSyncRun.findMany({
      where: { syncRunId },
    });
  }

  /**
   * Finalize parent sync run based on child results
   */
  async finalizeSyncRun(
    syncRunId: string,
    sources: SourceSyncRun[]
  ): Promise<SyncRun> {
    const allSuccess = sources.every((s) => s.status === 'SUCCESS');
    const anySuccess = sources.some((s) => s.status === 'SUCCESS');

    let status: SyncRunStatus;
    if (allSuccess) {
      status = 'SUCCESS';
    } else if (anySuccess) {
      status = 'PARTIAL_SUCCESS';
    } else {
      status = 'FAILED';
    }

    return prisma.syncRun.update({
      where: { id: syncRunId },
      data: {
        status,
        finishedAt: new Date(),
        summary: {
          sources: sources.map((s) => ({
            source: s.source,
            status: s.status,
            recordsWritten: s.recordsWritten,
            recordsFailed: s.recordsFailed,
            errorCode: s.errorCode,
          })),
        },
      },
    });
  }

  /**
   * Get sync run by ID
   */
  async getSyncRun(syncRunId: string): Promise<SyncRun | null> {
    return prisma.syncRun.findUnique({
      where: { id: syncRunId },
      include: { sourceSyncRuns: true },
    });
  }

  /**
   * Get recent sync runs
   */
  async getRecentSyncRuns(limit: number = 20): Promise<SyncRun[]> {
    return prisma.syncRun.findMany({
      take: -limit,
      orderBy: { startedAt: 'desc' },
      include: { sourceSyncRuns: true },
    });
  }
}

export const syncRunRepository = new SyncRunRepository();
