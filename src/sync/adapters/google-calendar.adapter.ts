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
const logger = getLogger('google-calendar-adapter');

interface GoogleCalendarEvent {
  kind: 'calendar#event';
  etag: string;
  id: string;
  status: 'confirmed' | 'tentativeMove' | 'cancelled';
  htmlLink: string;
  created: string;
  updated: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: {
    date?: string;
    dateTime?: string;
    timeZone?: string;
  };
  end?: {
    date?: string;
    dateTime?: string;
    timeZone?: string;
  };
  recurringEventId?: string;
  originalStartTime?: {
    dateTime?: string;
    timeZone?: string;
  };
  organizer?: {
    email: string;
    displayName?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus: string;
  }>;
}

interface GoogleCalendarListResponse {
  kind: 'calendar#events';
  etag: string;
  summary: string;
  description?: string;
  updated: string;
  timeZone?: string;
  accessRole: string;
  defaultReminders?: Array<{ method: string; minutes: number }>;
  nextPageToken?: string;
  nextSyncToken?: string;
  items: GoogleCalendarEvent[];
}

function checkPageLimit(pageCount: number, maxPages: number, context: string): void {
  if (pageCount >= maxPages) {
    throw new Error(
      `Page limit exceeded: ${pageCount} >= ${maxPages} in ${context}`
    );
  }
}

export class GoogleCalendarAdapter extends BaseAdapter implements SourceAdapter {
  source = 'GOOGLE_CALENDAR';
  private clientId = config.GOOGLE_CLIENT_ID;
  private clientSecret = config.GOOGLE_CLIENT_SECRET;
  private refreshToken = config.GOOGLE_REFRESH_TOKEN;
  private calendarId = config.GOOGLE_CALENDAR_ID;
  private pageSize = config.GOOGLE_CALENDAR_PAGE_SIZE;
  private baseUrl = 'https://www.googleapis.com/calendar/v3';
  private accessToken: string | null = null;
  private accessTokenExpiry: number | null = null;

  /**
   * Full sync: fetch all events including deleted
   */
  async *fullSync(ctx: SyncContext): AsyncGenerator<SourcePage<string>> {
    logger.info('Starting full sync of Google Calendar events');

    try {
      await this.ensureAccessToken();

      let pageToken: string | undefined;
      let pageCount = 0;
      let syncToken: string | undefined;

      while (true) {
        ctx.signal.throwIfAborted();
        checkPageLimit(pageCount, ctx.maxPages, 'Google Calendar full sync');

        const params = new URLSearchParams();
        params.append('maxResults', String(this.pageSize));
        params.append('showDeleted', 'true');
        if (pageToken) params.append('pageToken', pageToken);

        const url = `${this.baseUrl}/calendars/${this.calendarId}/events?${params}`;

        const response = await this.fetchWithTimeout<GoogleCalendarListResponse>(
          url,
          {
            method: 'GET',
            headers: this.getHeaders(),
          },
          ctx.requestTimeoutMs,
          ctx.signal
        );

        if (!Array.isArray(response.items)) {
          throw new Error('Invalid Google Calendar response');
        }

        logger.debug({ pageCount, recordsCount: response.items.length }, 'Fetched page');

        // Store the final sync token for incremental syncs
        if (response.nextSyncToken) {
          syncToken = response.nextSyncToken;
        }

        yield {
          records: response.items,
          nextCursor: response.nextPageToken || syncToken,
          hasMore: !!response.nextPageToken,
        };

        pageCount++;

        if (!response.nextPageToken) {
          break;
        }

        pageToken = response.nextPageToken;
      }

      logger.info({ pagesProcessed: pageCount, syncToken }, 'Full sync completed');
    } catch (error) {
      logger.error({ error }, 'Full sync failed');
      throw ErrorClassifier.classifyError(error);
    }
  }

  /**
   * Incremental sync: use syncToken for efficient updates
   */
  async *incrementalSync(
    checkpoint: CheckpointState<string>,
    ctx: SyncContext
  ): AsyncGenerator<SourcePage<string>> {
    logger.info({ checkpoint }, 'Starting incremental sync of Google Calendar events');

    if (!checkpoint.cursor) {
      logger.warn('No sync token found, falling back to full sync');
      yield* this.fullSync(ctx);
      return;
    }

    try {
      await this.ensureAccessToken();

      const params = new URLSearchParams();
      params.append('maxResults', String(this.pageSize));
      params.append('syncToken', checkpoint.cursor);
      params.append('showDeleted', 'true');

      const url = `${this.baseUrl}/calendars/${this.calendarId}/events?${params}`;

      const response = await this.fetchWithTimeout<GoogleCalendarListResponse>(
        url,
        {
          method: 'GET',
          headers: this.getHeaders(),
        },
        ctx.requestTimeoutMs,
        ctx.signal
      );

      if (!Array.isArray(response.items)) {
        throw new Error('Invalid Google Calendar response');
      }

      logger.debug({ recordsCount: response.items.length }, 'Fetched incremental changes');

      yield {
        records: response.items,
        nextCursor: response.nextSyncToken,
        hasMore: false,
      };

      logger.info({ recordsCount: response.items.length }, 'Incremental sync completed');
    } catch (error: any) {
      // 410 Gone means sync token is invalid
      if (error.status === 410 || (error.message && error.message.includes('410'))) {
        logger.warn('Sync token invalid (410 Gone), falling back to full sync');
        throw ErrorClassifier.classifyError(error);
      }
      logger.error({ error }, 'Incremental sync failed');
      throw ErrorClassifier.classifyError(error);
    }
  }

  /**
   * Normalize Google Calendar event to CalendarEvent record
   */
  normalize(raw: GoogleCalendarEvent): NormalizedRecord {
    const startDateTime = raw.start?.dateTime || raw.start?.date;
    const endDateTime = raw.end?.dateTime || raw.end?.date;
    const isAllDay = !!raw.start?.date && !raw.start?.dateTime;

    return {
      externalId: raw.id,
      externalObjectType: 'event',
      externalVersion: raw.etag,
      sourceUpdatedAt: new Date(raw.updated),
      normalizedType: 'CALENDAR_EVENT',
      normalizedId: `google-event-${raw.id}`,
      isDeleted: raw.status === 'cancelled',
      data: {
        calendarExternalId: this.calendarId,
        summary: raw.summary || null,
        description: raw.description || null,
        startAt: startDateTime ? new Date(startDateTime) : null,
        endAt: endDateTime ? new Date(endDateTime) : null,
        isAllDay,
        timezone: raw.start?.timeZone || null,
        status: raw.status,
        organizerEmail: raw.organizer?.email || null,
        attendees: raw.attendees
          ? raw.attendees.map((a) => ({
              email: a.email,
              displayName: a.displayName,
              responseStatus: a.responseStatus,
            }))
          : null,
        recurringEventExternalId: raw.recurringEventId || null,
      },
      hash: this.computeHash(raw),
    };
  }

  /**
   * Check if error is a 410 Gone (stale sync token)
   */
  isStaleCursorError(error: any): boolean {
    return (
      error?.status === 410 ||
      (error?.message && typeof error.message === 'string' && error.message.includes('410'))
    );
  }

  /**
   * Ensure access token is valid
   */
  private async ensureAccessToken(): Promise<void> {
    if (this.accessToken && this.accessTokenExpiry && this.accessTokenExpiry > Date.now()) {
      return;
    }

    await this.refreshAccessToken();
  }

  /**
   * Refresh access token using refresh token
   */
  private async refreshAccessToken(): Promise<void> {
    const body = new URLSearchParams();
    body.append('client_id', this.clientId || '');
    body.append('client_secret', this.clientSecret || '');
    body.append('refresh_token', this.refreshToken || '');
    body.append('grant_type', 'refresh_token');

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new Error(`Failed to refresh Google OAuth token: ${response.status}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };

    this.accessToken = data.access_token;
    this.accessTokenExpiry = Date.now() + (data.expires_in - 60) * 1000;

    logger.debug('Google OAuth token refreshed');
  }

  /**
   * Get auth headers for Google API
   */
  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Compute hash for change detection
   */
  private computeHash(event: GoogleCalendarEvent): string {
    const canonical = JSON.stringify(
      {
        summary: event.summary,
        description: event.description,
        start: event.start,
        end: event.end,
        status: event.status,
      },
      null,
      0
    );
    return crypto.createHash('sha256').update(canonical).digest('hex');
  }
}

export const googleCalendarAdapter = new GoogleCalendarAdapter();
