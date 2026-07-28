import { prisma } from '../prisma';
import { ExternalRecord, SourceType, NormalizedType } from '../../generated/prisma';

export class ExternalRecordRepository {
  /**
   * Upsert external record with idempotency
   * Ensures no duplicates by source identity
   */
  async upsertExternalRecord(data: {
    connectionId: string;
    source: SourceType;
    externalObjectType: string;
    externalId: string;
    externalVersion?: string;
    sourceUpdatedAt?: Date;
    normalizedType: NormalizedType;
    normalizedId: string;
    isDeleted?: boolean;
    rawPayload?: any;
    payloadHash?: string;
  }): Promise<ExternalRecord> {
    return prisma.externalRecord.upsert({
      where: {
        connectionId_externalObjectType_externalId: {
          connectionId: data.connectionId,
          externalObjectType: data.externalObjectType,
          externalId: data.externalId,
        },
      },
      update: {
        externalVersion: data.externalVersion,
        sourceUpdatedAt: data.sourceUpdatedAt,
        normalizedId: data.normalizedId,
        isDeleted: data.isDeleted || false,
        rawPayload: data.rawPayload,
        payloadHash: data.payloadHash,
        lastSeenAt: new Date(),
        updatedAt: new Date(),
      },
      create: {
        connectionId: data.connectionId,
        source: data.source,
        externalObjectType: data.externalObjectType,
        externalId: data.externalId,
        externalVersion: data.externalVersion,
        sourceUpdatedAt: data.sourceUpdatedAt,
        normalizedType: data.normalizedType,
        normalizedId: data.normalizedId,
        isDeleted: data.isDeleted || false,
        rawPayload: data.rawPayload,
        payloadHash: data.payloadHash,
      },
    });
  }

  /**
   * Get external record by source identity
   */
  async getExternalRecord(
    connectionId: string,
    externalObjectType: string,
    externalId: string
  ): Promise<ExternalRecord | null> {
    return prisma.externalRecord.findUnique({
      where: {
        connectionId_externalObjectType_externalId: {
          connectionId,
          externalObjectType,
          externalId,
        },
      },
    });
  }

  /**
   * Get all records for a normalized ID
   */
  async getByNormalizedId(normalizedId: string): Promise<ExternalRecord[]> {
    return prisma.externalRecord.findMany({
      where: { normalizedId },
    });
  }

  /**
   * Get records for a connection and type
   */
  async getRecordsByConnection(
    connectionId: string,
    externalObjectType?: string
  ): Promise<ExternalRecord[]> {
    return prisma.externalRecord.findMany({
      where: {
        connectionId,
        ...(externalObjectType && { externalObjectType }),
      },
    });
  }

  /**
   * Mark record as deleted/soft-delete
   */
  async markDeleted(externalRecordId: string): Promise<ExternalRecord> {
    return prisma.externalRecord.update({
      where: { id: externalRecordId },
      data: {
        isDeleted: true,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Count records by connection
   */
  async countByConnection(connectionId: string): Promise<number> {
    return prisma.externalRecord.count({
      where: { connectionId },
    });
  }
}

export const externalRecordRepository = new ExternalRecordRepository();
