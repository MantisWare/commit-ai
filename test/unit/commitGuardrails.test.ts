import { checkCommitSizeGuardrails } from '../../src/utils/commitGuardrails';

describe('checkCommitSizeGuardrails', () => {
  it('throws when staged file count exceeds maxFiles', () => {
    expect(() =>
      checkCommitSizeGuardrails(5, 100, { maxFiles: 2 })
    ).toThrow(/Too many staged files/);
  });

  it('throws when diff bytes exceed maxDiffBytes', () => {
    expect(() =>
      checkCommitSizeGuardrails(1, 50, { maxDiffBytes: 10 })
    ).toThrow(/Staged diff is too large/);
  });

  it('allows commits within configured limits', () => {
    expect(() =>
      checkCommitSizeGuardrails(3, 500, {
        maxFiles: 10,
        maxDiffBytes: 1000
      })
    ).not.toThrow();
  });
});
