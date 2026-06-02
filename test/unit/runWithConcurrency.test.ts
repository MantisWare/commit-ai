import {
  isRateLimitError,
  runWithConcurrency
} from '../../src/utils/runWithConcurrency';

describe('runWithConcurrency', () => {
  it('preserves task result order', async () => {
    const results = await runWithConcurrency({
      tasks: [
        async () => 'a',
        async () => 'b',
        async () => 'c',
        async () => 'd',
        async () => 'e'
      ],
      concurrency: 2,
      batchDelayMs: 0
    });

    expect(results).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('reports progress as tasks complete', async () => {
    const progress: Array<[number, number]> = [];

    await runWithConcurrency({
      tasks: [async () => 1, async () => 2, async () => 3],
      concurrency: 2,
      batchDelayMs: 0,
      onProgress: (completed, total) => {
        progress.push([completed, total]);
      }
    });

    expect(progress).toEqual([
      [2, 3],
      [3, 3]
    ]);
  });

  it('retries batch on rate limit errors', async () => {
    let attempts = 0;

    const results = await runWithConcurrency({
      tasks: [
        async () => {
          attempts += 1;
          if (attempts === 1) {
            throw new Error('429 Too Many Requests');
          }
          return 'ok';
        }
      ],
      concurrency: 1,
      batchDelayMs: 0,
      maxRetries: 2
    });

    expect(results).toEqual(['ok']);
    expect(attempts).toBe(2);
  });

  it('returns empty array for no tasks', async () => {
    const results = await runWithConcurrency({
      tasks: [],
      concurrency: 4
    });

    expect(results).toEqual([]);
  });
});

describe('isRateLimitError', () => {
  it('detects common rate limit messages', () => {
    expect(isRateLimitError(new Error('429 Too Many Requests'))).toBe(true);
    expect(isRateLimitError(new Error('rate limit exceeded'))).toBe(true);
    expect(isRateLimitError(new Error('network timeout'))).toBe(false);
  });
});
