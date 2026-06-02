import { planCommitBatches } from '../../src/utils/planCommitBatches';

describe('planCommitBatches', () => {
  it('splits by file count and diff bytes', async () => {
    const fileBytes: Record<string, number> = {
      a: 30_000,
      b: 30_000,
      c: 10_000,
      d: 10_000
    };

    const measureDiffBytes = async (files: string[]) =>
      files.reduce((sum, file) => sum + (fileBytes[file] ?? 0), 0);

    const batches = await planCommitBatches(
      ['a', 'b', 'c', 'd'],
      { maxFiles: 2, maxDiffBytes: 50_000 },
      measureDiffBytes
    );

    expect(batches).toEqual([['a'], ['b', 'c'], ['d']]);
  });

  it('shrinks a batch when combined diff exceeds maxDiffBytes', async () => {
    const measureDiffBytes = async (files: string[]) => {
      if (files.length === 1) {
        return files[0] === 'big' ? 40_000 : 5_000;
      }
      return files.length * 20_000;
    };

    const batches = await planCommitBatches(
      ['big', 'small1', 'small2'],
      { maxDiffBytes: 50_000 },
      measureDiffBytes
    );

    expect(batches.length).toBeGreaterThan(1);
    for (const batch of batches) {
      const bytes = await measureDiffBytes(batch);
      expect(bytes).toBeLessThanOrEqual(50_000);
    }
  });
});
