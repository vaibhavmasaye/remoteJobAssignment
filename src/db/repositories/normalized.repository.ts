import { Prisma } from '@prisma/client';
import { prisma } from '../connection';
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
  async create(data: {
    source: string;
    entityType: string;
    entityData: any;
    externalRecordId?: string;
  }): Promise<NormalizedRecord> {
    return prisma.normalizedRecord.create({
      data: {
        id: uuidv4().replace(/-/g, '').substring(0, 24),
        source: data.source,
        entityType: data.entityType,
        entityData: data.entityData as Prisma.InputJsonValue,
        externalRecordId: data.externalRecordId,
      },
    }) as unknown as Promise<NormalizedRecord>;
  }

  async getBySourceAndType(source: string, entityType: string, limit = 1000): Promise<NormalizedRecord[]> {
    return prisma.normalizedRecord.findMany({
      where: { source, entityType },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }) as unknown as Promise<NormalizedRecord[]>;
  }
}

export const normalizedRepository = new NormalizedRepository();
