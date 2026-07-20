import {
  collapseRepeatedNgrams,
  sanitizeLocalOutput
} from '../../src/local/sanitizeOutput';

describe('collapseRepeatedNgrams', () => {
  it('collapses a repeated multi-word phrase to a single occurrence', () => {
    const phrase = 'add new file implementation checklist';
    const looped = `${phrase} ${phrase} ${phrase} ${phrase}`;
    expect(collapseRepeatedNgrams(looped)).toBe(phrase);
  });

  it('collapses a single word repeated 3+ times', () => {
    expect(collapseRepeatedNgrams('fix fix fix fix bug')).toBe('fix bug');
  });

  it('preserves a word that only repeats twice', () => {
    expect(collapseRepeatedNgrams('very very good change here')).toBe(
      'very very good change here'
    );
  });

  it('keeps a unique prefix before the looped tail', () => {
    const prefix = 'update port handling';
    const phrase = 'add checklist doc';
    const input = `${prefix} ${phrase} ${phrase} ${phrase}`;
    expect(collapseRepeatedNgrams(input)).toBe(`${prefix} ${phrase}`);
  });

  it('leaves non-repeating text untouched', () => {
    const text = 'refactor the server startup and add tests';
    expect(collapseRepeatedNgrams(text)).toBe(text);
  });
});

describe('sanitizeLocalOutput', () => {
  it('returns undefined for undefined input', () => {
    expect(sanitizeLocalOutput(undefined)).toBeUndefined();
  });

  it('strips <think> reasoning blocks', () => {
    const input = '<think>let me reason</think>feat: add feature';
    expect(sanitizeLocalOutput(input)).toBe('feat: add feature');
  });

  it('collapses a runaway single-line repetition loop', () => {
    const phrase =
      'add new file `implementations-checklist.md` create documentation';
    const looped = Array.from({ length: 200 }, () => phrase).join(' ');
    const result = sanitizeLocalOutput(looped);
    expect(result).toBe(phrase);
  });

  it('collapses consecutive duplicate lines', () => {
    const input = 'feat: add thing\nfeat: add thing\nfeat: add thing';
    expect(sanitizeLocalOutput(input)).toBe('feat: add thing');
  });

  it('returns undefined when output is only whitespace', () => {
    expect(sanitizeLocalOutput('   \n  \n')).toBeUndefined();
  });
});
