import {
  collapseRepeatedNgrams,
  sanitizeLocalOutput,
  stripDiffArtifacts,
  stripLeadingPreamble
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

  it('strips leading conversational preamble', () => {
    const input =
      "Here's the commit message:\nfeat: add local model support";
    expect(sanitizeLocalOutput(input)).toBe('feat: add local model support');
  });

  it('strips a multi-sentence preamble line', () => {
    const input =
      "To create a clean and comprehensive commit message, we need to follow the guidelines. Here's a condensed commit message per file:\nrefactor: clean up local runtime";
    expect(sanitizeLocalOutput(input)).toBe('refactor: clean up local runtime');
  });

  it('removes hallucinated diff blocks wrapped in code fences', () => {
    const input = [
      '```diff',
      ' diff --git a/src/utils/sanitizeOutput.js b/.github/workflows/server-config.yml',
      '```',
      'feat: add output sanitization for local models'
    ].join('\n');
    expect(sanitizeLocalOutput(input)).toBe(
      'feat: add output sanitization for local models'
    );
  });

  it('drops full echoed diff hunks but keeps the real message', () => {
    const input = [
      'chore: update server config',
      'diff --git a/src/server.ts b/src/server.ts',
      'index ad4db42..f3b18a9 100644',
      '--- a/src/server.ts',
      '+++ b/src/server.ts',
      '@@ -10,7 +10,7 @@'
    ].join('\n');
    expect(sanitizeLocalOutput(input)).toBe('chore: update server config');
  });

  it('returns undefined when only preamble and diffs remain', () => {
    const input = [
      "Here's a condensed commit message per file:",
      '```diff',
      ' diff --git a/src/local/ggufRuntime.js b/.github/workflows/server-config.yml',
      '```'
    ].join('\n');
    expect(sanitizeLocalOutput(input)).toBeUndefined();
  });
});

describe('stripDiffArtifacts', () => {
  it('removes diff headers and code fences, keeping real lines', () => {
    const lines = [
      '```diff',
      'diff --git a/a.ts b/a.ts',
      'index ad4db42..f3b18a9 100644',
      '--- a/a.ts',
      '+++ b/a.ts',
      '@@ -1,2 +1,2 @@',
      'feat: keep me'
    ];
    expect(stripDiffArtifacts(lines)).toEqual(['feat: keep me']);
  });

  it('does not remove bullet lines that start with a dash', () => {
    const lines = ['fix: thing', '- adjusts the retry logic'];
    expect(stripDiffArtifacts(lines)).toEqual([
      'fix: thing',
      '- adjusts the retry logic'
    ]);
  });
});

describe('stripLeadingPreamble', () => {
  it('drops leading blank and preamble lines only', () => {
    const lines = ['', 'Sure!', 'feat: add thing', 'The change is small'];
    expect(stripLeadingPreamble(lines)).toEqual([
      'feat: add thing',
      'The change is small'
    ]);
  });

  it('leaves a message with no preamble untouched', () => {
    const lines = ['feat: add thing', 'body line'];
    expect(stripLeadingPreamble(lines)).toEqual(['feat: add thing', 'body line']);
  });
});
