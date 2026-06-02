import { formatCommitProgressLabel } from '../../src/utils/commitProgressLabel';

describe('formatCommitProgressLabel', () => {
  const base = 'Cooking up the commit message';

  it('formats preparing phase with counts', () => {
    expect(
      formatCommitProgressLabel(base, {
        phase: 'preparing',
        completed: 3,
        total: 10
      })
    ).toBe(`${base} — preparing chunks (3/10)`);
  });

  it('formats generating phase with counts', () => {
    expect(
      formatCommitProgressLabel(base, {
        phase: 'generating',
        completed: 2,
        total: 5
      })
    ).toBe(`${base} — generating chunk 2/5`);
  });

  it('formats synthesizing phase', () => {
    expect(
      formatCommitProgressLabel(base, { phase: 'synthesizing' })
    ).toBe(`${base} — synthesizing commit message`);
  });
});
