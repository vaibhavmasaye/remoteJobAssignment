import { BaseAdapter } from './base-adapter';
import {
  SourceAdapter,
  SyncContext,
  SourcePage,
  CheckpointState,
  NormalizedRecord,
} from '../types';
import { ErrorClassifier } from '../error-classifier';
import { getLogger } from '../../observability/logger';
import { getConfig } from '../../config/env';
import crypto from 'crypto';
import { SourceType } from '../../generated/prisma';

const config = getConfig();
const logger = getLogger('stripe-adapter');

interface StripeCustomer {
  id: string;
  object: 'customer';
  email?: string;
  name?: string;
  phone?: string;
  created: number;
  metadata?: Record<string, string>;
}

interface StripePaymentIntent {
  id: string;
  object: 'payment_intent';
  amount: number;
  currency: string;
  status: string;
  payment_method?: string;
  created: number;
  charges?: {
    data: Array<{ paid: boolean; refunded: boolean; refunds?: { total: number } }>;
  };
  metadata?: Record<string, string>;
}

interface StripeEvent {
  id: string;
  object: 'event';
  type: string;
  created: number;
  data: { object: StripeCustomer | StripePaymentIntent | any };
}

interface StripeListResponse<T> {
  object: 'list';
  data: T[];
  has_more: boolean;
  url: string;
}

function checkPageLimit(pageCount: number, maxPages: number, context: string): void {
  if (pageCount >= maxPages) {
    throw new Error(
      `Page limit exceeded: ${pageCount} >= ${maxPages} in ${context}`
    );
  }
}

export class StripeAdapter extends BaseAdapter implements SourceAdapter {
  source = SourceType.STRIPE;
  private token = config.STRIPE_SECRET_KEY;
  private baseUrl = 'https://api.stripe.com/v1';
  private pageSize = config.STRIPE_PAGE_SIZE;
  private reconciliationHours = config.STRIPE_RECONCILIATION_LOOKBACK_HOURS;

  /**
   * Full sync: fetch all customers and payment intents
   */
  async *fullSync(ctx: SyncContext): AsyncGenerator<SourcePage<string>> {
    logger.info('Starting full sync of Stripe data');

    // Fetch all customers
    logger.info('Fetching Stripe customers');
    yield* this.fetchCustomers(ctx, undefined);

    // Fetch all payment intents
    logger.info('Fetching Stripe payment intents');
    yield* this.fetchPaymentIntents(ctx, undefined);

    logger.info('Full sync completed');
  }

  /**
   * Incremental sync: fetch recent objects and use events for changes
   */
  async *incrementalSync(
    checkpoint: CheckpointState<string>,
    ctx: SyncContext
  ): AsyncGenerator<SourcePage<string>> {
    logger.info({ checkpoint }, 'Starting incremental sync of Stripe data');

    // Use event watermark if available
    let startingAfter: number | undefined;
    if (checkpoint.watermark) {
      startingAfter = Math.floor(checkpoint.watermark.getTime() / 1000);
    }

    // Fetch recent events
    logger.info('Fetching Stripe events');
    yield* this.fetchEvents(ctx, startingAfter);

    // Also reconcile recently updated objects
    logger.info('Reconciling recent payment intents');
    const reconcileTime = Math.floor(
      (Date.now() - this.reconciliationHours * 3600 * 1000) / 1000
    );
    yield* this.fetchPaymentIntents(ctx, reconcileTime);
  }

  /**
   * Fetch paginated customers
   */
  private async *fetchCustomers(
    ctx: SyncContext,
    createdAfter?: number
  ): AsyncGenerator<SourcePage<string>> {
    let after: string | undefined;
    let pageCount = 0;

    try {
      while (true) {
        ctx.signal.throwIfAborted();
        checkPageLimit(pageCount, ctx.maxPages, 'Stripe customers');

        const params = new URLSearchParams();
        params.append('limit', String(this.pageSize));
        if (after) params.append('starting_after', after);
        if (createdAfter) params.append('created[gte]', String(createdAfter));

        const response = await this.fetchWithTimeout<StripeListResponse<StripeCustomer>>(
          `${this.baseUrl}/customers?${params}`,
          {
            method: 'GET',
            headers: this.getHeaders(),
          },
          ctx.requestTimeoutMs,
          ctx.signal
        );

        if (!Array.isArray(response.data)) {
          throw new Error('Invalid Stripe response');
        }

        logger.debug({ pageCount, recordsCount: response.data.length }, 'Fetched customers');

        yield {
          records: response.data,
          nextCursor: response.data.length > 0 ? response.data[response.data.length - 1].id : undefined,
          hasMore: response.has_more,
        };

        pageCount++;

        if (!response.has_more || !response.data.length) {
          break;
        }

        after = response.data[response.data.length - 1].id;
      }
    } catch (error) {
      logger.error({ error, pageCount }, 'Failed to fetch customers');
      throw ErrorClassifier.classifyError(error);
    }
  }

  /**
   * Fetch paginated payment intents
   */
  private async *fetchPaymentIntents(
    ctx: SyncContext,
    createdAfter?: number
  ): AsyncGenerator<SourcePage<string>> {
    let after: string | undefined;
    let pageCount = 0;

    try {
      while (true) {
        ctx.signal.throwIfAborted();
        checkPageLimit(pageCount, ctx.maxPages, 'Stripe payment intents');

        const params = new URLSearchParams();
        params.append('limit', String(this.pageSize));
        if (after) params.append('starting_after', after);
        if (createdAfter) params.append('created[gte]', String(createdAfter));

        const response = await this.fetchWithTimeout<StripeListResponse<StripePaymentIntent>>(
          `${this.baseUrl}/payment_intents?${params}`,
          {
            method: 'GET',
            headers: this.getHeaders(),
          },
          ctx.requestTimeoutMs,
          ctx.signal
        );

        if (!Array.isArray(response.data)) {
          throw new Error('Invalid Stripe response');
        }

        logger.debug({ pageCount, recordsCount: response.data.length }, 'Fetched payment intents');

        yield {
          records: response.data,
          nextCursor: response.data.length > 0 ? response.data[response.data.length - 1].id : undefined,
          hasMore: response.has_more,
        };

        pageCount++;

        if (!response.has_more || !response.data.length) {
          break;
        }

        after = response.data[response.data.length - 1].id;
      }
    } catch (error) {
      logger.error({ error, pageCount }, 'Failed to fetch payment intents');
      throw ErrorClassifier.classifyError(error);
    }
  }

  /**
   * Fetch events for incremental updates
   */
  private async *fetchEvents(
    ctx: SyncContext,
    startingAfter?: number
  ): AsyncGenerator<SourcePage<string>> {
    let after: string | undefined;
    let pageCount = 0;

    try {
      while (true) {
        ctx.signal.throwIfAborted();
        checkPageLimit(pageCount, ctx.maxPages, 'Stripe events');

        const params = new URLSearchParams();
        params.append('limit', String(this.pageSize));
        if (after) params.append('starting_after', after);
        if (startingAfter) params.append('created[gte]', String(startingAfter));

        const response = await this.fetchWithTimeout<StripeListResponse<StripeEvent>>(
          `${this.baseUrl}/events?${params}`,
          {
            method: 'GET',
            headers: this.getHeaders(),
          },
          ctx.requestTimeoutMs,
          ctx.signal
        );

        if (!Array.isArray(response.data)) {
          throw new Error('Invalid Stripe response');
        }

        logger.debug({ pageCount, recordsCount: response.data.length }, 'Fetched events');

        yield {
          records: response.data,
          nextCursor: response.data.length > 0 ? response.data[response.data.length - 1].id : undefined,
          hasMore: response.has_more,
        };

        pageCount++;

        if (!response.has_more || !response.data.length) {
          break;
        }

        after = response.data[response.data.length - 1].id;
      }
    } catch (error) {
      logger.error({ error, pageCount }, 'Failed to fetch events');
      throw ErrorClassifier.classifyError(error);
    }
  }

  /**
   * Normalize Stripe objects to normalized records
   */
  normalize(raw: StripeCustomer | StripePaymentIntent | StripeEvent): NormalizedRecord {
    if (raw.object === 'customer') {
      return this.normalizeCustomer(raw as StripeCustomer);
    } else if (raw.object === 'payment_intent') {
      return this.normalizePaymentIntent(raw as StripePaymentIntent);
    } else if (raw.object === 'event') {
      const event = raw as StripeEvent;
      if (event.data.object.object === 'customer') {
        return this.normalizeCustomer(event.data.object as StripeCustomer);
      } else if (event.data.object.object === 'payment_intent') {
        return this.normalizePaymentIntent(event.data.object as StripePaymentIntent);
      }
    }

    throw new Error(`Unknown Stripe object type: ${(raw as any).object}`);
  }

  private normalizeCustomer(customer: StripeCustomer): NormalizedRecord {
    return {
      externalId: customer.id,
      externalObjectType: 'customer',
      externalVersion: String(customer.created),
      sourceUpdatedAt: new Date(customer.created * 1000),
      normalizedType: 'PERSON',
      normalizedId: `stripe-customer-${customer.id}`,
      data: {
        email: customer.email || null,
        fullName: customer.name || null,
        phone: customer.phone || null,
        status: 'active',
      },
      hash: this.computeHash(customer),
    };
  }

  private normalizePaymentIntent(intent: StripePaymentIntent): NormalizedRecord {
    const refundedAmount = intent.charges?.data.reduce((sum, charge) => {
      return sum + (charge.refunds?.total || 0);
    }, 0) || 0;

    return {
      externalId: intent.id,
      externalObjectType: 'payment_intent',
      externalVersion: String(intent.created),
      sourceUpdatedAt: new Date(intent.created * 1000),
      normalizedType: 'PAYMENT',
      normalizedId: `stripe-intent-${intent.id}`,
      data: {
        amountMinor: BigInt(intent.amount),
        currency: intent.currency.toUpperCase(),
        status: intent.status,
        paymentMethodType: intent.payment_method ? 'card' : null,
        paidAt: intent.status === 'succeeded' ? new Date(intent.created * 1000) : null,
        refundedAmountMinor: BigInt(refundedAmount),
      },
      hash: this.computeHash(intent),
    };
  }

  /**
   * Check if error is stale cursor
   */
  isStaleCursorError(error: any): boolean {
    return error?.status === 410 || error?.code === 'resource_missing';
  }

  /**
   * Get auth headers for Stripe API
   */
  private getHeaders(): Record<string, string> {
    const auth = Buffer.from(`${this.token}:`).toString('base64');
    return {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    };
  }

  /**
   * Compute hash for change detection
   */
  private computeHash(obj: any): string {
    const canonical = JSON.stringify(obj, Object.keys(obj).sort());
    return crypto.createHash('sha256').update(canonical).digest('hex');
  }
}

export const stripeAdapter = new StripeAdapter();
