const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

export const isRateLimitError = (error: unknown): boolean => {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes('429') ||
    message.includes('rate limit') ||
    message.includes('too many requests')
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
      if (isRateLimitError(error) && retries < maxRetries) {
        retries += 1;
        const sleepMs =
          retries === 1 ? jitterMs(5000, 2000) : jitterMs(60000, 5000);
        onRetry?.(taskIndex, retries, sleepMs, error);
        await delay(sleepMs);
        continue;
      }
      throw error;
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
