import {
  DEFAULT_LARGE_FILE_DIFF_BYTES,
  findLargeFileDiffs,
  formatByteSize
} from '../../src/utils/largeFileDiffs';

const makeFileDiff = (file: string, body: string): string =>
  [
    `diff --git a/${file} b/${file}`,
    'index 0000000..1111111 100644',
    `--- a/${file}`,
    `+++ b/${file}`,
    '@@ -1,1 +1,1 @@',
    body,
    ''
  ].join('\n');

describe('findLargeFileDiffs', () => {
  it('returns nothing when all file diffs are under the threshold', () => {
    const diff =
      makeFileDiff('a.ts', '+const a = 1;') +
      makeFileDiff('b.ts', '+const b = 2;');

    expect(findLargeFileDiffs(diff, 1024)).toEqual([]);
  });

  it('flags only the files over the threshold with their sizes', () => {
    const bigBody = '+' + 'var x=1;'.repeat(5000); // ~40 KB
    const diff =
      makeFileDiff('out/bundle.cjs', bigBody) +
      makeFileDiff('src/index.ts', '+const x = 1;');

    const result = findLargeFileDiffs(diff, 16 * 1024);

    expect(result).toHaveLength(1);
    expect(result[0].file).toBe('out/bundle.cjs');
    expect(result[0].bytes).toBeGreaterThan(16 * 1024);
  });

  it('resolves names of deleted files from the --- header', () => {
    const bigBody = '-' + 'var x=1;'.repeat(5000);
    const deletionDiff = [
      'diff --git a/out/old.cjs b/out/old.cjs',
      'deleted file mode 100644',
      'index 1111111..0000000',
      '--- a/out/old.cjs',
      '+++ /dev/null',
      '@@ -1,1 +0,0 @@',
      bigBody,
      ''
    ].join('\n');

    const result = findLargeFileDiffs(deletionDiff, 16 * 1024);

    expect(result).toHaveLength(1);
    expect(result[0].file).toBe('out/old.cjs');
  });

  it('is disabled when the threshold is 0', () => {
    const bigBody = '+' + 'var x=1;'.repeat(5000);
    const diff = makeFileDiff('out/bundle.cjs', bigBody);

    expect(findLargeFileDiffs(diff, 0)).toEqual([]);
  });

  it('defaults to 1 MB', () => {
    expect(DEFAULT_LARGE_FILE_DIFF_BYTES).toBe(1024 * 1024);
  });
});

describe('formatByteSize', () => {
  it('formats KB and MB', () => {
    expect(formatByteSize(64 * 1024)).toBe('64 KB');
    expect(formatByteSize(4.2 * 1024 * 1024)).toBe('4.2 MB');
  });
});
