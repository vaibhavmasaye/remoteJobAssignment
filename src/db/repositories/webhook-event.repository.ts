import { prisma } from '../prisma';
import { ProcessedWebhookEvent, SourceType, WebhookEventStatus } from '../../generated/prisma';

export class WebhookEventRepository {
  /**
   * Check if webhook event has been processed (deduplication)
   */
  async isWebhookProcessed(
    source: SourceType,
    externalEventId: string
  ): Promise<boolean> {
    const event = await prisma.processedWebhookEvent.findUnique({
      where: {
        source_externalEventId: {
          source,
          externalEventId,
        },
      },
    });
    return !!event;
  }

  /**
   * Record webhook receipt for deduplication
   */
  async recordWebhookReceipt(data: {
    source: SourceType;
    externalEventId: string;
    payloadHash: string;
  }): Promise<ProcessedWebhookEvent> {
    return prisma.processedWebhookEvent.upsert({
      where: {
        source_externalEventId: {
          source: data.source,
          externalEventId: data.externalEventId,
        },
      },
      update: {
        status: 'RECEIVED',
        receivedAt: new Date(),
      },
      create: {
        source: data.source,
        externalEventId: data.externalEventId,
        payloadHash: data.payloadHash,
        status: 'RECEIVED',
      },
    });
  }

  /**
   * Mark webhook as processed
   */
  async markWebhookProcessed(
    source: SourceType,
    externalEventId: string
  ): Promise<ProcessedWebhookEvent> {
    return prisma.processedWebhookEvent.update({
      where: {
        source_externalEventId: {
          source,
          externalEventId,
        },
      },
      data: {
        status: 'PROCESSED',
        processedAt: new Date(),
      },
    });
  }

  /**
   * Mark webhook as failed
   */
  async markWebhookFailed(
    source: SourceType,
    externalEventId: string,
    error: string
  ): Promise<ProcessedWebhookEvent> {
    return prisma.processedWebhookEvent.update({
      where: {
        source_externalEventId: {
          source,
          externalEventId,
        },
      },
      data: {
        status: 'FAILED',
        lastError: error,
        retryCount: {
          increment: 1,
        },
      },
    });
  }

  /**
   * Get unprocessed webhook events
   */
  async getUnprocessedWebhooks(limit: number = 100): Promise<ProcessedWebhookEvent[]> {
    return prisma.processedWebhookEvent.findMany({
      where: {
        status: 'RECEIVED',
      },
      take: limit,
      orderBy: { receivedAt: 'asc' },
    });
  }
}

export const webhookEventRepository = new WebhookEventRepository();
