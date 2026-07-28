import { prisma } from '../prisma';
import { SourceType, SyncCheckpoint } from '../../generated/prisma';

export class CheckpointRepository {
  /**
   * Get current checkpoint for a source and object type
   */
  async getCheckpoint(
    connectionId: string,
    objectType: string
  ): Promise<SyncCheckpoint | null> {
    return prisma.syncCheckpoint.findUnique({
      where: {
        connectionId_objectType: {
          connectionId,
          objectType,
        },
      },
    });
  }

  /**
   * Get or create checkpoint with defaults
   */
  async getOrCreateCheckpoint(
    connectionId: string,
    objectType: string
  ): Promise<SyncCheckpoint> {
    return prisma.syncCheckpoint.upsert({
      where: {
        connectionId_objectType: {
          connectionId,
          objectType,
        },
      },
      update: {},
      create: {
        connectionId,
        objectType,
      },
    });
  }

  /**
   * Update checkpoint with new cursor/watermark and timestamps
   * Should only be called after successful data commit
   */
  async advanceCheckpoint(
    checkpointId: string,
    data: {
      cursor?: string | null;
      watermark?: Date | null;
      lastFullSyncAt?: Date;
      lastIncrementalSyncAt?: Date;
    }
  ): Promise<SyncCheckpoint> {
    return prisma.syncCheckpoint.update({
      where: { id: checkpointId },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Clear checkpoint cursor/watermark (useful for fallback scenarios)
   */
  async clearCheckpoint(checkpointId: string): Promise<SyncCheckpoint> {
    return prisma.syncCheckpoint.update({
      where: { id: checkpointId },
      data: {
        cursor: null,
        watermark: null,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Get all checkpoints for a connection
   */
  async getCheckpointsByConnection(connectionId: string): Promise<SyncCheckpoint[]> {
    return prisma.syncCheckpoint.findMany({
      where: { connectionId },
    });
  }
}

export const checkpointRepository = new CheckpointRepository();
