import { SyncContext, SourceAdapter, NormalizedRecord } from './types';
import { idempotentWriter } from './idempotent-writer';
import { failedRecordRepository, syncRunRepository, checkpointRepository } from '../db/repositories';
import { getLogger } from '../observability/logger';
import { hubspotAdapter } from './adapters/hubspot.adapter';
import { stripeAdapter } from './adapters/stripe.adapter';
import { googleCalendarAdapter } from './adapters/google-calendar.adapter';
import { SourceType } from './types';

const logger = getLogger('orchestrator');

export interface SyncOptions {
  source?: SourceType;
  mode?: 'full' | 'incremental';
  maxPages?: number;
  pageSize?: number;
}

/**
 * Orchestrates sync runs across all sources
 */
export class SyncOrchestrator {
  private adapters: Map<SourceType, SourceAdapter> = new Map([
    ['HUBSPOT', hubspotAdapter as unknown as SourceAdapter],
    ['STRIPE', stripeAdapter as unknown as SourceAdapter],
    ['GOOGLE_CALENDAR', googleCalendarAdapter as unknown as SourceAdapter],
  ]);

  /**
   * Trigger a full sync across all enabled sources
   */
  async triggerSync(
    connectionIds: Map<SourceType, string>,
    options: SyncOptions = {}
  ): Promise<string> {
    const syncRun = await syncRunRepository.createSyncRun({
      triggerType: 'MANUAL',
      requestedBy: 'api',
    });

    logger.info(
      { runId: syncRun.id, correlationId: syncRun.correlationId },
      'Starting sync run'
    );

    // Determine which sources to sync
    const sourcesToSync = options.source
      ? [options.source]
      : Array.from(this.adapters.keys());

    // Run source syncs in parallel with isolation
    const sourceRunPromises = sourcesToSync
      .filter((source) => connectionIds.has(source))
      .map((source) =>
        this.syncSource(
          syncRun.id,
          connectionIds.get(source)!,
          source,
          options
        ).catch((error) => {
          logger.error({ error, source }, 'Source sync failed');
          return { source, error };
        })
      );

    const sourceResults = await Promise.allSettled(sourceRunPromises);

    // Collect results
    const sourceSyncRuns = await syncRunRepository.getSyncRunSources(syncRun.id);
    const finalRun = await syncRunRepository.finalizeSyncRun(syncRun.id, sourceSyncRuns);

    logger.info(
      { runId: syncRun.id, status: finalRun.status, sources: sourceSyncRuns.length },
      'Sync run completed'
    );

    return syncRun.id;
  }

  /**
   * Sync a single source
   */
  private async syncSource(
    syncRunId: string,
    connectionId: string,
    source: SourceType,
    options: SyncOptions
  ): Promise<void> {
    const adapter = this.adapters.get(source);
    if (!adapter) {
      throw new Error(`No adapter found for source: ${source}`);
    }

    // Create child source run
    const sourceSyncRun = await syncRunRepository.createSourceSyncRun({
      syncRunId,
      connectionId,
      source,
      mode: 'INCREMENTAL',
    });

    logger.info(
      { runId: sourceSyncRun.id, source, connectionId },
      `Starting ${source} sync`
    );

    const controller = new AbortController();
    const config = require('../config/env').getConfig();

    const context: SyncContext = {
      syncRunId,
      sourceSyncRunId: sourceSyncRun.id,
      connectionId,
      source,
      maxPages: options.maxPages || config.SYNC_MAX_PAGES,
      pageSize: options.pageSize || config.SYNC_PAGE_SIZE,
      requestTimeoutMs: config.SYNC_REQUEST_TIMEOUT_MS,
      overlapSeconds: config.SYNC_OVERLAP_SECONDS,
      signal: controller.signal,
    };

    let checkpoint = await checkpointRepository.getOrCreateCheckpoint({ connectionId, objectType: 'contact' });

    try {
      let recordsSeen = 0;
      let recordsWritten = 0;
      let recordsSkipped = 0;
      let recordsFailed = 0;

      // Determine sync mode
      const shouldFull = !checkpoint.cursor && !checkpoint.watermark;
      const syncMode = shouldFull ? 'full' : 'incremental';

      logger.info({ source, mode: syncMode }, `Using ${syncMode} sync mode`);

      // Get the appropriate sync generator
      let generator: AsyncGenerator<any>;
      if (shouldFull) {
        generator = adapter.fullSync(context);
      } else {
        generator = adapter.incrementalSync(checkpoint, context);
      }

      // Process pages
      let pageCount = 0;
      for await (const page of generator) {
        try {
          recordsSeen += page.records.length;

          // Normalize and validate records
          const normalizedRecords: NormalizedRecord[] = [];
          for (const record of page.records) {
            try {
              const normalized = adapter.normalize(record);
              normalizedRecords.push(normalized);
            } catch (error) {
              recordsFailed++;
              logger.warn({ error, record }, 'Normalization failed');

              await failedRecordRepository.create({
                connectionId,
                objectType: 'contact',
                externalId: record.id,
                errorMessage: error instanceof Error ? error.message : String(error),
              });
            }
          }

          // Write batch
          if (normalizedRecords.length > 0) {
            const writeResult = await idempotentWriter.writeBatch(
              connectionId,
              source,
              normalizedRecords,
              sourceSyncRun.id
            );

            recordsWritten += writeResult.written;
            recordsSkipped += writeResult.skipped;
            recordsFailed += writeResult.failed;
          }

          pageCount++;

          logger.debug(
            { pageCount, recordsSeen, recordsWritten },
            'Page processed'
          );
        } catch (pageError) {
          logger.error({ pageError, pageCount }, 'Page processing failed');
          throw pageError;
        }
      }

      // Update checkpoint after successful completion
      const newCheckpoint = new Date();
      await checkpointRepository.advanceCheckpoint(connectionId, 'contact', {
        watermark: newCheckpoint,
      });

      // Finalize source run
      await syncRunRepository.updateSourceSyncRun(sourceSyncRun.id, {
        status: 'SUCCESS',
        recordCount: recordsWritten,
        finishedAt: new Date(),
      });

      logger.info(
        { source, recordsSeen, recordsWritten, recordsSkipped, recordsFailed },
        `${source} sync completed`
      );
    } catch (error: any) {
      logger.error({ error, source }, `${source} sync failed`);

      // Check if it's a stale cursor
      if (adapter.isStaleCursorError(error)) {
        logger.warn({ source }, 'Stale cursor detected, will fallback to full sync');

        await checkpointRepository.clearCheckpoint(connectionId, 'contact');

        await syncRunRepository.updateSourceSyncRun(sourceSyncRun.id, {
          status: 'FAILED',
          errorMessage: 'Sync token/cursor invalid, cleared for full resync',
          finishedAt: new Date(),
        });
      } else {
        await syncRunRepository.updateSourceSyncRun(sourceSyncRun.id, {
          status: 'FAILED',
          errorMessage: error?.message || String(error),
          finishedAt: new Date(),
        });
      }

      throw error;
    } finally {
      controller.abort();
    }
  }
}

export const syncOrchestrator = new SyncOrchestrator();
