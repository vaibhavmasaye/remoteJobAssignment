import { RetryConfig, ClassifiedError, ErrorType } from './types';
import { getLogger } from '../observability/logger';

const logger = getLogger('retry');

/**
 * Calculate backoff delay with exponential growth and jitter
 */
export function calculateBackoffDelay(
  attempt: number,
  config: RetryConfig,
  retryAfterHeader?: string
): number {
  // Respect Retry-After header if present
  if (retryAfterHeader) {
    const seconds = parseInt(retryAfterHeader, 10);
    if (!isNaN(seconds)) {
      return seconds * 1000;
    }
  }

  // Exponential backoff: base * 2^attempt
  const exponentialDelay = config.baseDelayMs * Math.pow(2, Math.min(attempt, 5));

  // Cap at max delay
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);

  // Add jitter: +/- jitterFactor * delay
  const jitter = (Math.random() - 0.5) * 2 * cappedDelay * config.jitterFactor;
  return Math.max(100, cappedDelay + jitter);
}

/**
 * Retry wrapper for async operations
 */
export async function retryWithBackoff<T>(
  fn: (attempt: number) => Promise<T>,
  config: RetryConfig,
  context: { operation: string; source?: string }
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;

      if (attempt < config.maxRetries) {
        const delay = calculateBackoffDelay(attempt, config);
        logger.warn(
          { error, attempt, delay, ...context },
          `Retry ${attempt + 1}/${config.maxRetries} after ${delay}ms`
        );
        await sleep(delay);
      } else {
        logger.error({ error, attempts: attempt + 1, ...context }, 'All retries exhausted');
      }
    }
  }

  throw lastError;
}

/**
 * Check if error is retryable
 */
export function isRetryable(error: ClassifiedError): boolean {
  return error.retryable && error.type !== ErrorType.AUTH_FAILURE;
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Timeout wrapper with AbortController
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Operation timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    const onAbort = () => {
      clearTimeout(timeoutId);
      reject(new Error('Operation aborted'));
    };

    if (signal?.aborted) {
      clearTimeout(timeoutId);
      reject(new Error('Operation aborted'));
      return;
    }

    signal?.addEventListener('abort', onAbort);

    promise
      .then((result) => {
        clearTimeout(timeoutId);
        signal?.removeEventListener('abort', onAbort);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        signal?.removeEventListener('abort', onAbort);
        reject(error);
      });
  });
}
