import { applyClassicTlsGroupsFallback } from './tlsFallback';

const MAX_CAUSE_DEPTH = 5;

// Walks the `cause` chain because SDK errors (e.g. openai APIConnectionError)
// expose a generic message while the actual ECONNRESET sits in `error.cause`.
const collectErrorText = (error: unknown, depth: number = 0): string => {
  if (error === null || error === undefined || depth > MAX_CAUSE_DEPTH) {
    return '';
  }
  if (typeof error === 'string') return error;

  if (error instanceof Error) {
    const code = (error as NodeJS.ErrnoException).code;
    const causeText = collectErrorText(
      (error as Error & { cause?: unknown }).cause,
      depth + 1
    );

    return [error.message, typeof code === 'string' ? code : '', causeText]
      .filter((part) => part !== '')
      .join(' ');
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

const getErrorMessage = (error: unknown): string => collectErrorText(error);

export const isRateLimitError = (error: unknown): boolean => {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes('429') ||
    message.includes('rate limit') ||
    message.includes('too many requests')
  );
};

const TRANSIENT_NETWORK_ERROR_PATTERNS = [
  'econnreset',
  'econnrefused',
  'epipe',
  'enotfound',
  'eai_again',
  'etimedout',
  'econnaborted',
  'socket hang up',
  'connection error',
  'network error',
  'fetch failed'
];

export const isTransientNetworkError = (error: unknown): boolean => {
  const message = getErrorMessage(error).toLowerCase();
  return TRANSIENT_NETWORK_ERROR_PATTERNS.some((pattern) =>
    message.includes(pattern)
  );
};

export type TaskRunner<T> = () => Promise<T>;

export interface RunWithConcurrencyOptions<T> {
  tasks: TaskRunner<T>[];
  concurrency: number;
  onProgress?: (completed: number, total: number) => void;
  onTaskStart?: (taskIndex: number, total: number) => void;
  onTaskComplete?: (
    completed: number,
    total: number,
    taskIndex: number,
    result: T
  ) => void;
  onRetry?: (
    taskIndex: number,
    attempt: number,
    waitMs: number,
    error: unknown
  ) => void;
  batchDelayMs?: number;
  maxRetries?: number;
}

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const jitterMs = (baseMs: number, spreadMs: number): number =>
  baseMs + Math.floor(Math.random() * spreadMs);

const getRetryDelayMs = (error: unknown, attempt: number): number | null => {
  if (isRateLimitError(error)) {
    return attempt === 1 ? jitterMs(5000, 2000) : jitterMs(60000, 5000);
  }

  if (isTransientNetworkError(error)) {
    applyClassicTlsGroupsFallback();
    return jitterMs(2000 * attempt, 1000);
  }

  return null;
};

const runTaskWithRetries = async <T>(
  taskIndex: number,
  task: TaskRunner<T>,
  maxRetries: number,
  onRetry?: RunWithConcurrencyOptions<T>['onRetry']
): Promise<T> => {
  let retries = 0;

  while (true) {
    try {
      return await task();
    } catch (error) {
      const sleepMs =
        retries < maxRetries ? getRetryDelayMs(error, retries + 1) : null;

      if (sleepMs === null) {
        throw error;
      }

      retries += 1;
      onRetry?.(taskIndex, retries, sleepMs, error);
      await delay(sleepMs);
    }
  }
};

export async function runWithConcurrency<T>({
  tasks,
  concurrency,
  onProgress,
  onTaskStart,
  onTaskComplete,
  onRetry,
  batchDelayMs = 0,
  maxRetries = 3
}: RunWithConcurrencyOptions<T>): Promise<T[]> {
  if (tasks.length === 0) return [];

  const results: T[] = new Array(tasks.length);
  const total = tasks.length;
  const effectiveConcurrency = Math.max(1, Math.min(concurrency, total));

  let nextTaskIndex = 0;
  let completed = 0;

  const runWorker = async (): Promise<void> => {
    while (true) {
      const taskIndex = nextTaskIndex;
      nextTaskIndex += 1;

      if (taskIndex >= total) {
        return;
      }

      onTaskStart?.(taskIndex, total);

      const result = await runTaskWithRetries(
        taskIndex,
        tasks[taskIndex],
        maxRetries,
        onRetry
      );
      results[taskIndex] = result;
      completed += 1;

      onProgress?.(completed, total);
      onTaskComplete?.(completed, total, taskIndex, result);

      const hasMoreTasks = nextTaskIndex < total;
      if (
        hasMoreTasks &&
        batchDelayMs > 0 &&
        effectiveConcurrency > 1 &&
        completed % effectiveConcurrency === 0
      ) {
        await delay(jitterMs(batchDelayMs, 500));
      }
    }
  };

  await Promise.all(
    Array.from({ length: effectiveConcurrency }, () => runWorker())
  );

  return results;
};
