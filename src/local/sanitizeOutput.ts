/**
 * Post-processing for local SLM output.
 *
 * Small models (e.g. Qwen2.5 0.5B) misbehave in a few predictable ways:
 *  - degenerate repetition: the same word, phrase, or line is emitted over and
 *    over until the token budget is exhausted;
 *  - conversational preamble: e.g. "Here's the commit message:" or "To create a
 *    clean commit message, ...", instead of just the message;
 *  - diff regurgitation/hallucination: the model echoes raw `git diff` lines
 *    (sometimes pairing unrelated files) straight back into the "message".
 *
 * These helpers strip that noise so the caller receives a clean, bounded commit
 * message regardless of the model's behaviour. When nothing usable remains,
 * `sanitizeLocalOutput` returns undefined so the caller can treat it as an empty
 * generation rather than committing garbage.
 */

const THINK_TAG_PATTERN = /<think>[\s\S]*?<\/think>/g;

/**
 * Raw git-diff artifacts the model sometimes echoes or hallucinates. These are
 * never valid commit-message content and are dropped wholesale.
 */
const DIFF_ARTIFACT_PATTERNS: readonly RegExp[] = [
  /^diff --git /i,
  /^index [0-9a-f]{4,}\.\.[0-9a-f]{4,}/i,
  /^--- (a\/|"a\/|\/dev\/null)/,
  /^\+\+\+ (b\/|"b\/|\/dev\/null)/,
  /^@@ -\d+(,\d+)? \+\d+(,\d+)? @@/,
  /^new file mode /i,
  /^deleted file mode /i,
  /^old mode /i,
  /^new mode /i,
  /^rename (from|to) /i,
  /^copy (from|to) /i,
  /^similarity index /i,
  /^Binary files /i
];

/**
 * Leading conversational filler the model prepends before (or instead of) the
 * actual commit message. Only matched against leading lines so it never touches
 * a real message body.
 */
const PREAMBLE_PATTERNS: readonly RegExp[] = [
  /^(sure|certainly|of course|okay|ok|got it|understood|absolutely|great)\b[\s!,.:]*$/i,
  /^here('?s| is| are)\b/i,
  /^below (is|are)\b/i,
  /^to (create|write|craft|generate|make|produce|build)\b/i,
  /^this (is|commit|message|will)\b/i,
  /^the (commit|following|changes?|message)\b/i,
  /^(i'?ll|i will|i've|i have|let me|let's|we (need|can|should|will))\b/i,
  /^based on\b/i,
  /^as (an?|the|per|requested)\b/i,
  /^(following|according to|per) the\b/i,
  /commit message[^\n]*:$/i
];

/** Minimum consecutive repeats before a single-word loop is collapsed. */
const SINGLE_WORD_REPEAT_THRESHOLD = 3;

/** Largest n-gram (in words) we look for when detecting a repeating block. */
const MAX_REPEAT_PERIOD = 40;

const stripThinkingTags = (content: string): string => {
  if (content.includes('<think>') === true) {
    return content.replace(THINK_TAG_PATTERN, '').trim();
  }
  return content;
};

const blocksEqual = (
  words: readonly string[],
  aStart: number,
  bStart: number,
  length: number
): boolean => {
  for (let offset = 0; offset < length; offset += 1) {
    if (words[aStart + offset] !== words[bStart + offset]) {
      return false;
    }
  }
  return true;
};

/**
 * Collapses immediately-repeated word n-grams within a single line. A phrase
 * (period >= 2 words) repeated 2+ times, or a single word repeated 3+ times,
 * is reduced to a single occurrence. Non-repeating text is preserved verbatim
 * (aside from whitespace normalisation to single spaces).
 */
export const collapseRepeatedNgrams = (line: string): string => {
  const words = line.split(/\s+/).filter((word) => word.length > 0);
  if (words.length < 4) {
    return words.join(' ');
  }

  const result: Array<string> = [];
  let index = 0;

  while (index < words.length) {
    const remaining = words.length - index;
    const maxPeriod = Math.min(MAX_REPEAT_PERIOD, Math.floor(remaining / 2));
    let collapsed = false;

    for (let period = 1; period <= maxPeriod; period += 1) {
      let reps = 1;
      while (
        index + (reps + 1) * period <= words.length &&
        blocksEqual(words, index, index + reps * period, period) === true
      ) {
        reps += 1;
      }

      const isLoop =
        reps >= SINGLE_WORD_REPEAT_THRESHOLD || (reps >= 2 && period >= 2);
      if (reps >= 2 && isLoop === true) {
        for (let offset = 0; offset < period; offset += 1) {
          result.push(words[index + offset]);
        }
        index += reps * period;
        collapsed = true;
        break;
      }
    }

    if (collapsed !== true) {
      result.push(words[index]);
      index += 1;
    }
  }

  return result.join(' ');
};

const isCodeFence = (line: string): boolean => /^\s*(```|~~~)/.test(line);

const isDiffArtifact = (line: string): boolean => {
  const trimmed = line.trimStart();
  return DIFF_ARTIFACT_PATTERNS.some((pattern) => pattern.test(trimmed));
};

/**
 * Removes markdown code-fence markers and raw git-diff lines the model echoed
 * or hallucinated back into its output.
 */
export const stripDiffArtifacts = (lines: readonly string[]): Array<string> =>
  lines.filter(
    (line) => isCodeFence(line) !== true && isDiffArtifact(line) !== true
  );

const isPreambleLine = (line: string): boolean => {
  const trimmed = line.trim();
  if (trimmed === '') {
    return false;
  }
  return PREAMBLE_PATTERNS.some((pattern) => pattern.test(trimmed));
};

/**
 * Drops leading blank and conversational-preamble lines so the message starts
 * at the first line of real content. Only the leading run is inspected, so a
 * genuine body is never altered.
 */
export const stripLeadingPreamble = (
  lines: readonly string[]
): Array<string> => {
  let start = 0;
  while (start < lines.length) {
    const trimmed = lines[start].trim();
    if (trimmed === '' || isPreambleLine(lines[start]) === true) {
      start += 1;
      continue;
    }
    break;
  }
  return lines.slice(start);
};

/** Removes consecutive duplicate lines (ignoring surrounding whitespace). */
const collapseRepeatedLines = (lines: readonly string[]): Array<string> => {
  const result: Array<string> = [];
  let previous: string | undefined;

  for (const line of lines) {
    const normalized = line.trim();
    if (normalized !== previous || normalized === '') {
      result.push(line);
    }
    previous = normalized;
  }

  return result;
};

/**
 * Cleans raw local-model output: strips reasoning tags and collapses degenerate
 * repetition at both the line and intra-line (n-gram) level.
 */
export const sanitizeLocalOutput = (
  content: string | undefined
): string | undefined => {
  if (content === undefined) {
    return undefined;
  }

  const withoutThinking = stripThinkingTags(content);
  const withoutArtifacts = stripDiffArtifacts(withoutThinking.split('\n'));
  const collapsedNgrams = withoutArtifacts.map(collapseRepeatedNgrams);
  const deduped = collapseRepeatedLines(collapsedNgrams);
  const withoutPreamble = stripLeadingPreamble(deduped);
  const cleaned = withoutPreamble.join('\n').trim();

  return cleaned.length > 0 ? cleaned : undefined;
};
