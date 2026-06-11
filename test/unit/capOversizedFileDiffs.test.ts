import {
  capOversizedFileDiffs,
  DEFAULT_MAX_FILE_DIFF_BYTES
} from '../../src/utils/capOversizedFileDiffs';
import { getCommitMsgsPromisesFromFileDiffs } from '../../src/generateCommitMessageFromGitDiff';

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

describe('capOversizedFileDiffs', () => {
  it('returns small diffs unchanged', () => {
    const diff = makeFileDiff('src/index.ts', '+const x = 1;');
    expect(capOversizedFileDiffs(diff)).toBe(diff);
  });

  it('stubs oversized file diffs while keeping the header', () => {
    const bigBody = '+' + 'const x=1;'.repeat(20000); // ~200 KB
    const diff =
      makeFileDiff('out/cli.cjs', bigBody) +
      makeFileDiff('src/index.ts', '+const x = 1;');

    const capped = capOversizedFileDiffs(diff, 64 * 1024);

    expect(capped.length).toBeLessThan(diff.length);
    expect(capped).toContain('diff --git a/out/cli.cjs b/out/cli.cjs');
    expect(capped).toContain('[commit-ai: diff body omitted');
    expect(capped).not.toContain(bigBody);
    expect(capped).toContain('+const x = 1;');
    expect(capped).toContain('diff --git a/src/index.ts b/src/index.ts');
  });

  it('keeps all files when each is under the cap', () => {
    const diff =
      makeFileDiff('a.ts', '+const a = 1;') +
      makeFileDiff('b.ts', '+const b = 2;');

    // Total exceeds tiny cap but each file is under it.
    expect(capOversizedFileDiffs(diff, diff.length - 1)).toBe(diff);
  });

  it('has a sane default cap', () => {
    expect(DEFAULT_MAX_FILE_DIFF_BYTES).toBeGreaterThanOrEqual(16 * 1024);
  });
});

describe('huge single-line diff handling', () => {
  it(
    'splits a multi-MB single-line diff without freezing',
    async () => {
      // Simulates a minified bundle: one ~1.5 MB line. The previous
      // implementation re-tokenized the entire remaining line per slice
      // (quadratic), blocking the event loop for minutes to hours.
      const hugeLine = '+' + 'const x=1;'.repeat(150000);
      const diff = makeFileDiff('out/cli.cjs', hugeLine);

      const startedAt = Date.now();
      const tasks = await getCommitMsgsPromisesFromFileDiffs(diff, 1000, false);
      const elapsedMs = Date.now() - startedAt;

      expect(tasks.length).toBeGreaterThan(0);
      expect(elapsedMs).toBeLessThan(15000);
    },
    30000
  );
});
