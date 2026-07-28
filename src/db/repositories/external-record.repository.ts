import { Prisma } from '@prisma/client';
import { prisma } from '../connection';
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
  async upsertRecord(data: {
    connectionId: string;
    objectType: string;
    externalId: string;
    data: any;
  }): Promise<ExternalRecord> {
    const record = await prisma.externalRecord.upsert({
      where: {
        connectionId_objectType_externalId: {
          connectionId: data.connectionId,
          objectType: data.objectType,
          externalId: data.externalId,
        },
      },
      update: { data: data.data as Prisma.InputJsonValue },
      create: {
        id: uuidv4().replace(/-/g, '').substring(0, 24),
        connectionId: data.connectionId,
        objectType: data.objectType,
        externalId: data.externalId,
        data: data.data as Prisma.InputJsonValue,
      },
    });
    return record as unknown as ExternalRecord;
  }

  async getRecordsNeedingSync(connectionId: string): Promise<ExternalRecord[]> {
    const records = await prisma.externalRecord.findMany({
      where: { connectionId },
      orderBy: { updatedAt: 'asc' },
      take: 1000,
    });
    return records.filter((record) => !record.syncedAt || record.updatedAt > record.syncedAt) as unknown as ExternalRecord[];
  }

  async getExternalRecord(
    connectionId: string,
    objectType: string,
    externalId: string
  ): Promise<ExternalRecord | null> {
    return prisma.externalRecord.findUnique({
      where: { connectionId_objectType_externalId: { connectionId, objectType, externalId } },
    }) as unknown as Promise<ExternalRecord | null>;
  }

  async markRecordsSynced(recordIds: string[]): Promise<void> {
    if (recordIds.length === 0) return;
    await prisma.externalRecord.updateMany({
      where: { id: { in: recordIds } },
      data: { syncedAt: new Date() },
    });
  }
}

export const externalRecordRepository = new ExternalRecordRepository();
