import { Prisma } from '@prisma/client';
import { prisma } from '../connection';
import { v4 as uuidv4 } from 'uuid';

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
  async createSyncRun(data: { triggerType: string; requestedBy?: string }): Promise<SyncRun> {
    const now = new Date();
    return prisma.syncRun.create({
      data: {
        id: uuidv4().replace(/-/g, '').substring(0, 24),
        correlationId: `sync-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        status: 'RUNNING',
        triggerType: data.triggerType,
        requestedBy: data.requestedBy,
        startedAt: now,
      },
    }) as unknown as Promise<SyncRun>;
  }

  async createSourceSyncRun(data: {
    syncRunId: string;
    connectionId: string;
    source: string;
    mode: string;
  }): Promise<SourceSyncRun> {
    return prisma.sourceSyncRun.create({
      data: {
        id: uuidv4().replace(/-/g, '').substring(0, 24),
        syncRunId: data.syncRunId,
        connectionId: data.connectionId,
        source: data.source,
        mode: data.mode,
        status: 'RUNNING',
        startedAt: new Date(),
      },
    }) as unknown as Promise<SourceSyncRun>;
  }

  async updateSourceSyncRun(
    runId: string,
    data: { status?: string; recordCount?: number; errorMessage?: string; finishedAt?: Date }
  ): Promise<SourceSyncRun> {
    return prisma.sourceSyncRun.update({
      where: { id: runId },
      data,
    }) as unknown as Promise<SourceSyncRun>;
  }

  async getSourceSyncRun(runId: string): Promise<SourceSyncRun | null> {
    return prisma.sourceSyncRun.findUnique({ where: { id: runId } }) as unknown as Promise<SourceSyncRun | null>;
  }

  async getSyncRunSources(syncRunId: string): Promise<SourceSyncRun[]> {
    return prisma.sourceSyncRun.findMany({
      where: { syncRunId },
      orderBy: { createdAt: 'asc' },
    }) as unknown as Promise<SourceSyncRun[]>;
  }

  async finalizeSyncRun(syncRunId: string, sources: SourceSyncRun[]): Promise<SyncRun> {
    const allSuccess = sources.every((source) => source.status === 'SUCCESS');
    const anySuccess = sources.some((source) => source.status === 'SUCCESS');
    const status = allSuccess ? 'SUCCESS' : anySuccess ? 'PARTIAL_SUCCESS' : 'FAILED';
    const summary = {
      sources: sources.map(({ source, status, recordCount, errorMessage }) => ({
        source,
        status,
        recordCount,
        errorMessage,
      })),
    };

    return prisma.syncRun.update({
      where: { id: syncRunId },
      data: {
        status,
        finishedAt: new Date(),
        summary: summary as Prisma.InputJsonValue,
      },
    }) as unknown as Promise<SyncRun>;
  }

  async getSyncRun(syncRunId: string): Promise<SyncRun | null> {
    return prisma.syncRun.findUnique({ where: { id: syncRunId } }) as unknown as Promise<SyncRun | null>;
  }

  async getRecentSyncRuns(limit = 20): Promise<SyncRun[]> {
    return prisma.syncRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: limit,
    }) as unknown as Promise<SyncRun[]>;
  }
}

export const syncRunRepository = new SyncRunRepository();
