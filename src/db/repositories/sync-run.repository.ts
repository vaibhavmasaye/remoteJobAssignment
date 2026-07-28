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
    // A nested connect-or-create preserves the FK invariant in one query
    // without holding an interactive transaction/extra pool connection.
    const sourceRun = await prisma.sourceSyncRun.create({
      data: {
        id: uuidv4().replace(/-/g, '').substring(0, 24),
        source: data.source,
        mode: data.mode,
        status: 'RUNNING',
        startedAt: new Date(),
        syncRun: { connect: { id: data.syncRunId } },
        connection: {
          connectOrCreate: {
            where: { id: data.connectionId },
            create: {
              id: data.connectionId,
              source: data.source,
              accountExternalId: data.connectionId,
              status: 'ACTIVE',
            },
          },
        },
      },
    });

    return sourceRun as unknown as SourceSyncRun;
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
    const allSuccess = sources.length > 0 && sources.every((source) => source.status === 'SUCCESS');
    const anySuccess = sources.some((source) => source.status === 'SUCCESS');
    const status = allSuccess ? 'SUCCESS' : anySuccess ? 'PARTIAL_SUCCESS' : 'FAILED';
    const currentRun = await prisma.syncRun.findUniqueOrThrow({ where: { id: syncRunId } });
    const finishedAt = new Date();
    const summary = {
      sourceCount: sources.length,
      durationMs: finishedAt.getTime() - currentRun.startedAt.getTime(),
      sources: sources.map(({ source, status, recordCount, errorMessage, startedAt, finishedAt }) => ({
        source,
        status,
        recordCount,
        errorMessage,
        durationMs: finishedAt ? finishedAt.getTime() - startedAt.getTime() : undefined,
      })),
    };

    return prisma.syncRun.update({
      where: { id: syncRunId },
      data: {
        status,
        finishedAt,
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
