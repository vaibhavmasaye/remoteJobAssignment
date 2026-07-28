import { Prisma } from '@prisma/client';
import { prisma } from '../connection';
import { v4 as uuidv4 } from 'uuid';

export interface WebhookEvent {
  id: string;
  source: string;
  eventType: string;
  payload: any;
  processedAt?: Date;
  errorMessage?: string;
  createdAt: Date;
}

export class WebhookEventRepository {
  async create(data: {
    source: string;
    eventType: string;
    payload: any;
  }): Promise<WebhookEvent> {
    return prisma.webhookEvent.create({
      data: {
        id: uuidv4().replace(/-/g, '').substring(0, 24),
        source: data.source,
        eventType: data.eventType,
        payload: data.payload as Prisma.InputJsonValue,
      },
    }) as unknown as Promise<WebhookEvent>;
  }

  async markProcessed(eventId: string, errorMessage?: string): Promise<void> {
    await prisma.webhookEvent.update({
      where: { id: eventId },
      data: { processedAt: new Date(), errorMessage: errorMessage ?? null },
    });
  }
}

export const webhookEventRepository = new WebhookEventRepository();
