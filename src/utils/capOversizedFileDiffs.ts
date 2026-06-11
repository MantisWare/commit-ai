const FILE_SEPARATOR = 'diff --git ';
const HUNK_PREFIX = '@@';
const MAX_HEADER_LINES = 6;

export const DEFAULT_MAX_FILE_DIFF_BYTES = 65536;

const formatSize = (bytes: number): string => {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
};

const capFileDiff = (fileDiff: string, maxBytes: number): string => {
  const byteLength = Buffer.byteLength(fileDiff, 'utf8');
  if (byteLength <= maxBytes) {
    return FILE_SEPARATOR + fileDiff;
  }

  const lines = fileDiff.split('\n');
  const firstHunkIndex = lines.findIndex((line) =>
    line.startsWith(HUNK_PREFIX)
  );
  const headerLineCount =
    firstHunkIndex === -1
      ? Math.min(lines.length, MAX_HEADER_LINES)
      : firstHunkIndex;
  const header = lines.slice(0, headerLineCount).join('\n');

  return (
    `${FILE_SEPARATOR}${header}\n` +
    `[commit-ai: diff body omitted — ${formatSize(byteLength)} exceeds the ` +
    `${formatSize(maxBytes)} per-file limit (likely a generated or minified file). ` +
    `Describe this change as an update to the file named above.]\n`
  );
};

/**
 * Replaces the body of any single-file diff larger than `maxBytes` with a
 * short stub that still names the file.
 *
 * Multi-megabyte diffs of generated/minified files (bundles, source maps)
 * would otherwise be tokenized synchronously, blocking the event loop for
 * minutes to hours — freezing heartbeats and timeouts — and then fan out
 * into hundreds of API requests for a commit message that is meaningless
 * for generated content anyway.
 */
export const capOversizedFileDiffs = (
  diff: string,
  maxBytes: number = DEFAULT_MAX_FILE_DIFF_BYTES
): string => {
  if (diff.length <= maxBytes) {
    return diff;
  }

  const [preamble, ...fileDiffs] = diff.split(FILE_SEPARATOR);

  return (
    preamble +
    fileDiffs.map((fileDiff) => capFileDiff(fileDiff, maxBytes)).join('')
  );
};
