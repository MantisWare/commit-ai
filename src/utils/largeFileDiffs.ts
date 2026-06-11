const FILE_SEPARATOR = 'diff --git ';

export const DEFAULT_LARGE_FILE_DIFF_BYTES = 1024 * 1024; // 1 MB

export interface LargeFileDiff {
  file: string;
  bytes: number;
}

export const formatByteSize = (bytes: number): string => {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
};

const parseFileName = (fileSection: string): string => {
  const lines = fileSection.split('\n');

  // `+++ b/<path>` is the most reliable source (handles spaces in names);
  // deleted files have `+++ /dev/null`, so fall back to `--- a/<path>`.
  for (const line of lines) {
    if (line.startsWith('+++ b/')) return line.slice('+++ b/'.length);
  }
  for (const line of lines) {
    if (line.startsWith('--- a/')) return line.slice('--- a/'.length);
  }

  const firstLine = lines[0] ?? '';
  const bIndex = firstLine.lastIndexOf(' b/');
  return bIndex === -1 ? firstLine : firstLine.slice(bIndex + ' b/'.length);
};

/**
 * Finds files whose individual diff exceeds `thresholdBytes`. Diffs that
 * large are almost always generated or minified artifacts rather than
 * hand-written code.
 */
export const findLargeFileDiffs = (
  diff: string,
  thresholdBytes: number
): LargeFileDiff[] => {
  if (thresholdBytes <= 0 || diff.length <= thresholdBytes) {
    return [];
  }

  const fileSections = diff.split(FILE_SEPARATOR).slice(1);

  return fileSections
    .map((section) => ({
      file: parseFileName(section),
      bytes: Buffer.byteLength(section, 'utf8')
    }))
    .filter(({ bytes }) => bytes > thresholdBytes);
};
