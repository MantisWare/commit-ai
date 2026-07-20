/**
 * Post-processing for local SLM output.
 *
 * Small models (e.g. Qwen2.5 0.5B) are prone to degenerate repetition: they
 * get stuck emitting the same word, phrase, or line over and over until the
 * token budget is exhausted. That produces bloated commit messages and wastes
 * generation time. These helpers collapse that runaway repetition so the caller
 * receives a clean, bounded message regardless of the model's behaviour.
 */

const THINK_TAG_PATTERN = /<think>[\s\S]*?<\/think>/g;

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
  const lines = withoutThinking.split('\n').map(collapseRepeatedNgrams);
  const deduped = collapseRepeatedLines(lines);
  const cleaned = deduped.join('\n').trim();

  return cleaned.length > 0 ? cleaned : undefined;
};
