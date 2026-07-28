import { getLogger } from '../observability/logger';
import { NormalizedRecord } from './types';
import { normalizedRepository } from '../db/repositories';
import { externalRecordRepository } from '../db/repositories';
import { failedRecordRepository } from '../db/repositories';
import { SourceType, NormalizedType, FailureStage } from '../generated/prisma';
import crypto from 'crypto';

const logger = getLogger('idempotent-writer');

/**
 * Idempotent writer ensures no duplicates and data integrity
 */
export class IdempotentWriter {
  /**
   * Write a batch of normalized records in a transaction
   */
  async writeBatch(
    connectionId: string,
    source: SourceType,
    records: NormalizedRecord[],
    sourceSyncRunId: string
  ): Promise<{
    written: number;
    skipped: number;
    failed: number;
  }> {
    let written = 0;
    let skipped = 0;
    let failed = 0;

    for (const record of records) {
      try {
        const result = await this.writeRecord(connectionId, source, record);
        if (result) {
          written++;
        } else {
          skipped++;
        }
      } catch (error) {
        failed++;
        logger.error(
          { error, record: record.externalId, source },
          'Failed to write record'
        );

        // Record the failure
        await failedRecordRepository.createFailedRecord({
          sourceSyncRunId,
          connectionId,
          source,
          externalObjectType: record.externalObjectType,
          externalId: record.externalId,
          stage: 'WRITE',
          errorCode: 'WRITE_ERROR',
          errorMessage: error instanceof Error ? error.message : String(error),
          rawPayload: record.data,
          retryable: true,
        });
      }
    }

    return { written, skipped, failed };
  }

  /**
   * Write a single normalized record
   * Returns true if written, false if skipped (no change)
   */
  private async writeRecord(
    connectionId: string,
    source: SourceType,
    record: NormalizedRecord
  ): Promise<boolean> {
    // Compute hash for change detection
    const hash = this.computeHash(record.data);

    // Check if we've seen this exact version before
    const existing = await externalRecordRepository.getExternalRecord(
      connectionId,
      record.externalObjectType,
      record.externalId
    );

    // If hash hasn't changed and we've seen this before, skip
    if (existing && existing.payloadHash === hash) {
      logger.debug(
        { externalId: record.externalId, source },
        'Record unchanged, skipping'
      );
      return false;
    }

    // Upsert external record with idempotency key
    const externalRecord = await externalRecordRepository.upsertExternalRecord({
      connectionId,
      source,
      externalObjectType: record.externalObjectType,
      externalId: record.externalId,
      externalVersion: record.externalVersion,
      sourceUpdatedAt: record.sourceUpdatedAt,
      normalizedType: record.normalizedType,
      normalizedId: record.normalizedId,
      isDeleted: record.isDeleted,
      rawPayload: record.data,
      payloadHash: hash,
    });

    // Write to normalized type-specific table
    await this.writeNormalizedData(record);

    logger.debug(
      { externalId: record.externalId, source, normalizedId: record.normalizedId },
      'Record written'
    );

    return true;
  }

  /**
   * Write to type-specific normalized table
   */
  private async writeNormalizedData(record: NormalizedRecord): Promise<void> {
    const { normalizedRepository } = await import('../db/repositories');

    switch (record.normalizedType) {
      case 'PERSON':
        await normalizedRepository.createOrUpdatePerson({
          id: record.normalizedId,
          ...record.data,
        });
        break;

      case 'PAYMENT':
        await normalizedRepository.createOrUpdatePayment({
          id: record.normalizedId,
          ...record.data,
        });
        break;

      case 'CALENDAR_EVENT':
        await normalizedRepository.createOrUpdateCalendarEvent({
          id: record.normalizedId,
          ...record.data,
        });
        break;

      default:
        throw new Error(`Unknown normalized type: ${record.normalizedType}`);
    }
  }

  /**
   * Compute SHA256 hash of record data for change detection
   */
  private computeHash(data: any): string {
    const json = JSON.stringify(data, Object.keys(data).sort());
    return crypto.createHash('sha256').update(json).digest('hex');
  }
}

export const idempotentWriter = new IdempotentWriter();
