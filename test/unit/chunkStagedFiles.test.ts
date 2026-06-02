import { chunkStagedFiles } from '../../src/utils/chunkStagedFiles';
import { exceedsMaxStagedFiles } from '../../src/utils/commitGuardrails';

describe('chunkStagedFiles', () => {
  it('splits files into chunks of the configured size', () => {
    expect(chunkStagedFiles(['a', 'b', 'c', 'd', 'e'], 2)).toEqual([
      ['a', 'b'],
      ['c', 'd'],
      ['e']
    ]);
  });

  it('returns a single chunk when under the limit', () => {
    expect(chunkStagedFiles(['a', 'b'], 5)).toEqual([['a', 'b']]);
  });
});

describe('exceedsMaxStagedFiles', () => {
  it('returns true when staged files exceed maxFiles', () => {
    expect(exceedsMaxStagedFiles(31, { maxFiles: 30 })).toBe(true);
  });

  it('returns false when maxFiles is unset', () => {
    expect(exceedsMaxStagedFiles(100, {})).toBe(false);
  });

  it('returns false when within the limit', () => {
    expect(exceedsMaxStagedFiles(30, { maxFiles: 30 })).toBe(false);
  });
});
