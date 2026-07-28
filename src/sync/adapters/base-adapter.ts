import { SourceAdapter, SyncContext, SourcePage, CheckpointState } from '../types';
import { getLogger } from '../../observability/logger';
import { withTimeout } from '../retry';

/**
 * Base adapter with common functionality
 */
export abstract class BaseAdapter implements SourceAdapter {
  abstract source: any;

  protected getLogger(label: string) {
    return getLogger(label);
  }

  /**
   * Abstract methods to implement by subclasses
   */
  abstract fullSync(ctx: SyncContext): AsyncGenerator<SourcePage>;
  abstract incrementalSync(
    checkpoint: CheckpointState,
    ctx: SyncContext
  ): AsyncGenerator<SourcePage>;
  abstract isStaleCursorError(error: unknown): boolean;
  abstract normalize(raw: any): any;

  /**
   * Helper: fetch with timeout
   */
  protected async fetchWithTimeout<T>(
    url: string,
    options: RequestInit,
    timeoutMs: number,
    signal?: AbortSignal
  ): Promise<T> {
    const controller = new AbortController();
    const mergedSignal = signal || controller.signal;

    return withTimeout(
      fetch(url, {
        ...options,
        signal: mergedSignal,
      }).then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        return res.json() as Promise<T>;
      }),
      timeoutMs,
      signal
    );
  }

  /**
   * Helper: validate page has records
   */
  protected validatePage(page: any): page is SourcePage {
    return Array.isArray(page.records) && typeof page.hasMore === 'boolean';
  }

  /**
   * Helper: guard against infinite pagination
   */
  protected checkPageLimit(pageCount: number, maxPages: number, context: string): void {
    if (pageCount >= maxPages) {
      throw new Error(
        `Page limit exceeded: ${pageCount} >= ${maxPages} in ${context}`
      );
    }
  }
}
