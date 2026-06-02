import { tokenCount } from '../../src/utils/tokenCount';

describe('tokenCount', () => {
  it('returns consistent counts across repeated calls', () => {
    const sample = 'diff --git a/foo.ts b/foo.ts\n+const x = 1;';
    const first = tokenCount(sample);
    const second = tokenCount(sample);

    expect(second).toBe(first);
    expect(first).toBeGreaterThan(0);
  });

  it('counts longer text with more tokens', () => {
    const shortCount = tokenCount('hello');
    const longCount = tokenCount('hello world from commit-ai token counting');

    expect(longCount).toBeGreaterThan(shortCount);
  });
});
