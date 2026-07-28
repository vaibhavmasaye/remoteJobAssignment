import { execute } from '../connection';
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
  /**
   * Create webhook event
   */
  async create(data: {
    source: string;
    eventType: string;
    payload: any;
  }): Promise<WebhookEvent> {
    const id = uuidv4().replace(/-/g, '').substring(0, 24);
    const now = new Date();

    await execute(
      `INSERT INTO webhook_events (id, source, event_type, payload, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, data.source, data.eventType, JSON.stringify(data.payload), now]
    );

    return {
      id,
      source: data.source,
      eventType: data.eventType,
      payload: data.payload,
      createdAt: now,
    };
  }

  /**
   * Mark webhook as processed
   */
  async markProcessed(eventId: string, errorMessage?: string): Promise<void> {
    await execute(
      `UPDATE webhook_events SET processed_at = NOW(), error_message = $1 WHERE id = $2`,
      [errorMessage || null, eventId]
    );
  }
}

export const webhookEventRepository = new WebhookEventRepository();
