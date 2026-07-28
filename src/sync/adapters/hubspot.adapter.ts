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

const config = getConfig();
const logger = getLogger('hubspot-adapter');

interface HubSpotContact {
  id: string;
  properties: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  archived?: boolean;
}

interface HubSpotResponse {
  results: HubSpotContact[];
  paging?: {
    next?: {
      after: string;
      link: string;
    };
  };
}

interface HubSpotSearchResponse {
  results: Array<{
    id: string;
    properties: Record<string, string>;
    createdAt: string;
    updatedAt: string;
  }>;
  paging?: {
    next?: {
      after: string;
      link: string;
    };
  };
}

function checkPageLimit(pageCount: number, maxPages: number, context: string): void {
  if (pageCount >= maxPages) {
    throw new Error(
      `Page limit exceeded: ${pageCount} >= ${maxPages} in ${context}`
    );
  }
}

export class HubSpotAdapter extends BaseAdapter implements SourceAdapter {
  source = 'HUBSPOT';
  private token = config.HUBSPOT_ACCESS_TOKEN;
  private baseUrl = 'https://api.hubapi.com';
  private contactProperties = config.HUBSPOT_CONTACT_PROPERTIES.split(',').map((p) => p.trim());
  private pageSize = config.HUBSPOT_PAGE_SIZE;
  private overlapMs = config.SYNC_OVERLAP_SECONDS * 1000;

  /**
   * Full sync: fetch all contacts with pagination
   */
  async *fullSync(ctx: SyncContext): AsyncGenerator<SourcePage<string>> {
    logger.info('Starting full sync of HubSpot contacts');
    let after: string | undefined;
    let pageCount = 0;

    try {
      while (true) {
        ctx.signal.throwIfAborted();
        checkPageLimit(pageCount, ctx.maxPages, 'HubSpot full sync');

        const url = new URL(`${this.baseUrl}/crm/v3/objects/contacts`);
        url.searchParams.append('limit', String(this.pageSize));
        url.searchParams.append('properties', this.contactProperties.join(','));
        if (after) {
          url.searchParams.append('after', after);
        }

        const response = await this.fetchWithTimeout<HubSpotResponse>(
          url.toString(),
          {
            method: 'GET',
            headers: this.getHeaders(),
          },
          ctx.requestTimeoutMs,
          ctx.signal
        );

        if (!response.results) {
          throw new Error('Invalid HubSpot response: missing results');
        }

        logger.debug({ pageCount, recordsCount: response.results.length }, 'Fetched page');

        yield {
          records: response.results,
          nextCursor: response.paging?.next?.after,
          hasMore: !!response.paging?.next,
        };

        pageCount++;

        if (!response.paging?.next?.after) {
          break;
        }

        after = response.paging.next.after;
      }

      logger.info({ pagesProcessed: pageCount }, 'Full sync completed');
    } catch (error) {
      logger.error({ error, pageCount }, 'Full sync failed');
      throw ErrorClassifier.classifyError(error);
    }
  }

  /**
   * Incremental sync: fetch contacts updated since watermark with overlap window
   */
  async *incrementalSync(
    checkpoint: CheckpointState<string>,
    ctx: SyncContext
  ): AsyncGenerator<SourcePage<string>> {
    logger.info({ checkpoint }, 'Starting incremental sync of HubSpot contacts');

    if (!checkpoint.watermark) {
      logger.warn('No watermark found, falling back to full sync');
      yield* this.fullSync(ctx);
      return;
    }

    // Apply overlap window to catch late-indexed records
    const overlapStart = new Date(checkpoint.watermark.getTime() - this.overlapMs);
    const formattedTime = Math.floor(overlapStart.getTime());

    let after: string | undefined;
    let pageCount = 0;

    try {
      // Use HubSpot search API with filter for updated contacts
      while (true) {
        ctx.signal.throwIfAborted();
        checkPageLimit(pageCount, ctx.maxPages, 'HubSpot incremental sync');

        const url = `${this.baseUrl}/crm/v3/objects/contacts/search`;

        const body = {
          filterGroups: [
            {
              filters: [
                {
                  propertyName: 'hs_lastmodifieddate',
                  operator: 'GTE',
                  value: String(formattedTime),
                },
              ],
            },
          ],
          sorts: [
            {
              propertyName: 'hs_lastmodifieddate',
              direction: 'ASCENDING',
            },
            {
              propertyName: 'id',
              direction: 'ASCENDING',
            },
          ],
          properties: this.contactProperties,
          limit: this.pageSize,
          after,
        };

        const response = await this.fetchWithTimeout<HubSpotSearchResponse>(
          url,
          {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(body),
          },
          ctx.requestTimeoutMs,
          ctx.signal
        );

        logger.debug({ pageCount, recordsCount: response.results.length }, 'Fetched page');

        yield {
          records: response.results,
          nextCursor: response.paging?.next?.after,
          hasMore: !!response.paging?.next,
        };

        pageCount++;

        if (!response.paging?.next?.after) {
          break;
        }

        after = response.paging.next.after;
      }

      // Update watermark to current time
      const newWatermark = new Date();
      logger.info({ pagesProcessed: pageCount, newWatermark }, 'Incremental sync completed');

      yield {
        records: [],
        nextCursor: undefined,
        hasMore: false,
      };
    } catch (error) {
      if (this.isStaleCursorError(error)) {
        logger.warn({ error }, 'Stale cursor detected, incremental sync will fall back to full');
        throw ErrorClassifier.classifyError(error);
      }
      logger.error({ error, pageCount }, 'Incremental sync failed');
      throw ErrorClassifier.classifyError(error);
    }
  }

  /**
   * Normalize HubSpot contact to Person record
   */
  normalize(raw: HubSpotContact): NormalizedRecord {
    const props = raw.properties || {};

    return {
      externalId: raw.id,
      externalObjectType: 'contact',
      externalVersion: props.hs_lastmodifieddate || raw.updatedAt,
      sourceUpdatedAt: new Date(props.hs_lastmodifieddate || raw.updatedAt),
      normalizedType: 'PERSON',
      normalizedId: `hs-contact-${raw.id}`,
      isDeleted: raw.archived || false,
      data: {
        fullName: [props.firstname, props.lastname].filter(Boolean).join(' ') || null,
        firstName: props.firstname || null,
        lastName: props.lastname || null,
        email: props.email || null,
        phone: props.phone || null,
        companyName: props.company || null,
        status: raw.archived ? 'archived' : 'active',
      },
      hash: this.computeHash(raw),
    };
  }

  /**
   * Check if error is a stale cursor (invalid pagination)
   */
  isStaleCursorError(error: any): boolean {
    const message = error?.message || '';
    return (
      message.includes('Invalid pagination offset') ||
      message.includes('Pagination offset is not valid') ||
      error?.status === 400
    );
  }

  /**
   * Get auth headers for HubSpot API
   */
  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Compute hash for change detection
   */
  private computeHash(contact: HubSpotContact): string {
    const canonical = JSON.stringify(contact.properties, Object.keys(contact.properties || {}).sort());
    return crypto.createHash('sha256').update(canonical).digest('hex');
  }
}

export const hubspotAdapter = new HubSpotAdapter();
