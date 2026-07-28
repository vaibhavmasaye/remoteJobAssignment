import { SourceType, NormalizedType } from '../generated/prisma';

/**
 * Source adapter contract
 */
export interface SourceAdapter<TCursor = string | null> {
  source: SourceType;

  /**
   * Fetch all records from source (full sync)
   */
  fullSync(ctx: SyncContext): AsyncGenerator<SourcePage<TCursor>>;

  /**
   * Fetch only changed records using checkpoint
   */
  incrementalSync(
    checkpoint: CheckpointState<TCursor>,
    ctx: SyncContext
  ): AsyncGenerator<SourcePage<TCursor>>;

  /**
   * Check if error is a stale cursor (410 Gone, invalid token, etc.)
   */
  isStaleCursorError(error: unknown): boolean;

  /**
   * Normalize raw source record to normalized form
   */
  normalize(raw: any): NormalizedRecord;
}

/**
 * Sync context passed to adapters
 */
export interface SyncContext {
  syncRunId: string;
  sourceSyncRunId: string;
  connectionId: string;
  source: SourceType;
  maxPages: number;
  pageSize: number;
  requestTimeoutMs: number;
  overlapSeconds: number;
  signal: AbortSignal;
}

/**
 * Source page of records
 */
export interface SourcePage<TCursor = string | null> {
  records: any[];
  nextCursor?: TCursor;
  hasMore: boolean;
}

/**
 * Checkpoint state
 */
export interface CheckpointState<TCursor = string | null> {
  cursor?: TCursor;
  watermark?: Date;
  cursorVersion: number;
  lastFullSyncAt?: Date;
  lastIncrementalSyncAt?: Date;
}

/**
 * Normalized record to write to database
 */
export interface NormalizedRecord {
  externalId: string;
  externalObjectType: string;
  externalVersion?: string;
  sourceUpdatedAt?: Date;
  normalizedType: NormalizedType;
  normalizedId: string;
  isDeleted?: boolean;
  data: any;
  hash?: string;
}

/**
 * Error classification
 */
export enum ErrorType {
  RETRYABLE = 'RETRYABLE',
  PERMANENT = 'PERMANENT',
  AUTH_FAILURE = 'AUTH_FAILURE',
  STALE_CURSOR = 'STALE_CURSOR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RATE_LIMITED = 'RATE_LIMITED',
}

export interface ClassifiedError {
  type: ErrorType;
  code: string;
  message: string;
  httpStatus?: number;
  retryable: boolean;
  userFacing: string;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterFactor: number;
}

/**
 * Source connection state
 */
export interface SourceConnectionState {
  id: string;
  source: SourceType;
  status: 'ACTIVE' | 'DEGRADED' | 'DISABLED' | 'AUTH_REQUIRED';
  encryptedCredentials?: any;
}
