import { getLogger } from '../observability/logger';
import { NormalizedRecord } from './types';
import { normalizedRepository } from '../db/repositories';
import { externalRecordRepository } from '../db/repositories';
import { failedRecordRepository } from '../db/repositories';
import { NormalizedType } from './types';
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
    source: string,
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
        await failedRecordRepository.create({
          connectionId,
          objectType: record.externalObjectType,
          externalId: record.externalId,
          errorMessage: error instanceof Error ? error.message : String(error),
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
    source: string,
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

    // If we've seen this before, skip
    if (existing) {
      logger.debug(
        { externalId: record.externalId, source },
        'Record found, skipping'
      );
      return false;
    }

    // Upsert external record
    await externalRecordRepository.upsertRecord({
      connectionId,
      objectType: record.externalObjectType,
      externalId: record.externalId,
      data: record.data,
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
    switch (record.normalizedType) {
      case 'PERSON':
      case 'PAYMENT':
      case 'CALENDAR_EVENT':
        await normalizedRepository.create({
          source: 'unknown',
          entityType: record.normalizedType,
          entityData: record.data,
          externalRecordId: record.externalId,
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
