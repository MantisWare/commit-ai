import {
  isRateLimitError,
  isTransientNetworkError,
  runWithConcurrency
} from '../../src/utils/runWithConcurrency';

const createConnectionResetError = (): Error => {
  const cause = Object.assign(
    new Error(
      'request to https://api.openai.com/v1/chat/completions failed, reason: read ECONNRESET'
    ),
    { code: 'ECONNRESET' }
  );

  return Object.assign(new Error('Connection error.'), { cause });
};

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
      [1, 3],
      [2, 3],
      [3, 3]
    ]);
  });

  it('calls onTaskComplete for each finished task', async () => {
    const completedIndices: number[] = [];

    await runWithConcurrency({
      tasks: [async () => 'a', async () => 'b'],
      concurrency: 2,
      batchDelayMs: 0,
      onTaskComplete: (_completed, _total, taskIndex) => {
        completedIndices.push(taskIndex);
      }
    });

    expect(completedIndices.sort()).toEqual([0, 1]);
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

  it(
    'retries transient connection errors',
    async () => {
      let attempts = 0;

      const results = await runWithConcurrency({
        tasks: [
          async () => {
            attempts += 1;
            if (attempts === 1) {
              throw createConnectionResetError();
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
    },
    15000
  );

  it('does not retry non-transient errors', async () => {
    let attempts = 0;

    await expect(
      runWithConcurrency({
        tasks: [
          async () => {
            attempts += 1;
            throw new Error('Incorrect API key provided');
          }
        ],
        concurrency: 1,
        batchDelayMs: 0,
        maxRetries: 2
      })
    ).rejects.toThrow('Incorrect API key provided');

    expect(attempts).toBe(1);
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

describe('isTransientNetworkError', () => {
  it('detects ECONNRESET nested in the cause chain', () => {
    expect(isTransientNetworkError(createConnectionResetError())).toBe(true);
  });

  it('detects connection errors by message', () => {
    expect(isTransientNetworkError(new Error('Connection error.'))).toBe(true);
    expect(isTransientNetworkError(new Error('fetch failed'))).toBe(true);
    expect(isTransientNetworkError(new Error('socket hang up'))).toBe(true);
  });

  it('ignores unrelated errors', () => {
    expect(isTransientNetworkError(new Error('Incorrect API key'))).toBe(
      false
    );
    expect(isTransientNetworkError(new Error('TOO_MUCH_TOKENS'))).toBe(false);
  });
});
