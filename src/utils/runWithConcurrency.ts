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
  batchDelayMs?: number;
  maxRetries?: number;
}

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const jitterMs = (baseMs: number, spreadMs: number): number =>
  baseMs + Math.floor(Math.random() * spreadMs);

export async function runWithConcurrency<T>({
  tasks,
  concurrency,
  onProgress,
  batchDelayMs = 0,
  maxRetries = 3
}: RunWithConcurrencyOptions<T>): Promise<T[]> {
  if (tasks.length === 0) return [];

  const results: T[] = new Array(tasks.length);
  const effectiveConcurrency = Math.max(
    1,
    Math.min(concurrency, tasks.length)
  );

  let completed = 0;

  for (let step = 0; step < tasks.length; step += effectiveConcurrency) {
    const batchStart = step;
    const batchEnd = Math.min(step + effectiveConcurrency, tasks.length);
    const batchTasks = tasks.slice(batchStart, batchEnd);

    let retries = 0;

    while (true) {
      try {
        const batchResults = await Promise.all(
          batchTasks.map((task) => task())
        );

        for (let i = 0; i < batchResults.length; i += 1) {
          results[batchStart + i] = batchResults[i];
        }

        completed += batchResults.length;
        onProgress?.(completed, tasks.length);
        break;
      } catch (error) {
        if (isRateLimitError(error) && retries < maxRetries) {
          retries += 1;
          const sleepMs =
            retries === 1
              ? jitterMs(5000, 2000)
              : jitterMs(60000, 5000);
          await delay(sleepMs);
          continue;
        }
        throw error;
      }
    }

    const hasMoreBatches = batchEnd < tasks.length;
    if (
      hasMoreBatches &&
      batchDelayMs > 0 &&
      effectiveConcurrency > 1
    ) {
      await delay(jitterMs(batchDelayMs, 500));
    }
  }

  return results;
}
