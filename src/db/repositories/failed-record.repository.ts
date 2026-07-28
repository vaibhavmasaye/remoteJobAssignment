import { prisma } from '../prisma';
import { FailedRecord, SourceType, FailureStage } from '../../generated/prisma';

export class FailedRecordRepository {
  /**
   * Record a failed record without blocking the sync
   */
  async createFailedRecord(data: {
    sourceSyncRunId?: string;
    connectionId: string;
    source: SourceType;
    externalObjectType?: string;
    externalId?: string;
    stage: FailureStage;
    errorCode: string;
    errorMessage: string;
    rawPayload?: any;
    retryable: boolean;
  }): Promise<FailedRecord> {
    return prisma.failedRecord.create({
      data: {
        sourceSyncRunId: data.sourceSyncRunId,
        connectionId: data.connectionId,
        source: data.source,
        externalObjectType: data.externalObjectType,
        externalId: data.externalId,
        stage: data.stage,
        errorCode: data.errorCode,
        errorMessage: data.errorMessage,
        rawPayload: data.rawPayload,
        retryable: data.retryable,
        nextRetryAt: data.retryable ? new Date() : undefined,
      },
    });
  }

  /**
   * Get unresolved retryable failures
   */
  async getRetryableFailures(limit: number = 100): Promise<FailedRecord[]> {
    return prisma.failedRecord.findMany({
      where: {
        retryable: true,
        resolvedAt: null,
        nextRetryAt: {
          lte: new Date(),
        },
      },
      take: limit,
      orderBy: { nextRetryAt: 'asc' },
    });
  }

  /**
   * Update failed record after retry attempt
   */
  async updateFailureAttempt(
    recordId: string,
    data: {
      retryCount?: number;
      nextRetryAt?: Date;
      lastError?: string;
      resolved?: boolean;
    }
  ): Promise<FailedRecord> {
    return prisma.failedRecord.update({
      where: { id: recordId },
      data: {
        retryCount: data.retryCount,
        nextRetryAt: data.nextRetryAt,
        lastError: data.lastError,
        resolvedAt: data.resolved ? new Date() : undefined,
      },
    });
  }

  /**
   * Get failed records for a sync run
   */
  async getFailuresBySyncRun(sourceSyncRunId: string): Promise<FailedRecord[]> {
    return prisma.failedRecord.findMany({
      where: { sourceSyncRunId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Count failures by source
   */
  async countUnresolvedBySource(source: SourceType): Promise<number> {
    return prisma.failedRecord.count({
      where: {
        source,
        resolvedAt: null,
      },
    });
  }
}

export const failedRecordRepository = new FailedRecordRepository();
