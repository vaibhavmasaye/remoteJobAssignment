import { prisma } from '../connection';
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
  async create(data: {
    connectionId: string;
    objectType: string;
    externalId?: string;
    errorMessage: string;
    errorStack?: string;
  }): Promise<FailedRecord> {
    return prisma.failedRecord.create({
      data: {
        id: uuidv4().replace(/-/g, '').substring(0, 24),
        connectionId: data.connectionId,
        objectType: data.objectType,
        externalId: data.externalId,
        errorMessage: data.errorMessage,
        errorStack: data.errorStack,
      },
    }) as unknown as Promise<FailedRecord>;
  }

  async getFailedRecordsForRetry(connectionId: string, maxRetries = 5): Promise<FailedRecord[]> {
    return prisma.failedRecord.findMany({
      where: { connectionId, retryCount: { lt: maxRetries } },
      orderBy: { lastRetryAt: { sort: 'asc', nulls: 'first' } },
      take: 100,
    }) as unknown as Promise<FailedRecord[]>;
  }

  async incrementRetryCount(recordId: string): Promise<void> {
    await prisma.failedRecord.update({
      where: { id: recordId },
      data: { retryCount: { increment: 1 }, lastRetryAt: new Date() },
    });
  }
}

export const failedRecordRepository = new FailedRecordRepository();
