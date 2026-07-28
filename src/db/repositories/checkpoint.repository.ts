import { prisma } from '../connection';
import { v4 as uuidv4 } from 'uuid';

export interface SyncCheckpoint {
  id: string;
  connectionId: string;
  objectType: string;
  cursor?: string;
  watermark?: Date;
  cursorVersion: number;
  lastFullSyncAt?: Date;
  lastIncrementalSyncAt?: Date;
  updatedAt: Date;
}

export class CheckpointRepository {
  async getOrCreateCheckpoint(data: {
    connectionId: string;
    objectType: string;
  }): Promise<SyncCheckpoint> {
    const checkpoint = await prisma.syncCheckpoint.upsert({
      where: {
        connectionId_objectType: {
          connectionId: data.connectionId,
          objectType: data.objectType,
        },
      },
      update: {},
      create: {
        id: uuidv4().replace(/-/g, '').substring(0, 24),
        connectionId: data.connectionId,
        objectType: data.objectType,
      },
    });
    return checkpoint as unknown as SyncCheckpoint;
  }

  async updateCheckpoint(
    connectionId: string,
    objectType: string,
    data: {
      cursor?: string;
      watermark?: Date;
      cursorVersion?: number;
      lastFullSyncAt?: Date;
      lastIncrementalSyncAt?: Date;
    }
  ): Promise<SyncCheckpoint> {
    const checkpoint = await prisma.syncCheckpoint.update({
      where: { connectionId_objectType: { connectionId, objectType } },
      data,
    });
    return checkpoint as unknown as SyncCheckpoint;
  }

  async advanceCheckpoint(
    connectionId: string,
    objectType: string,
    data: { cursor?: string; watermark?: Date }
  ): Promise<SyncCheckpoint> {
    return this.updateCheckpoint(connectionId, objectType, {
      ...data,
      lastIncrementalSyncAt: new Date(),
    });
  }

  async clearCheckpoint(connectionId: string, objectType: string): Promise<void> {
    await prisma.syncCheckpoint.update({
      where: { connectionId_objectType: { connectionId, objectType } },
      data: { cursor: null, watermark: null, cursorVersion: { increment: 1 } },
    });
  }
}

export const checkpointRepository = new CheckpointRepository();
