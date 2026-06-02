import type { CommitSizeLimits } from './commitGuardrails';

export type MeasureDiffBytes = (files: string[]) => Promise<number>;

const getMaxFiles = (limits: CommitSizeLimits): number =>
  limits.maxFiles ?? Number.MAX_SAFE_INTEGER;

const getMaxDiffBytes = (limits: CommitSizeLimits): number =>
  limits.maxDiffBytes ?? Number.MAX_SAFE_INTEGER;

const batchFitsLimits = (
  fileCount: number,
  diffBytes: number,
  limits: CommitSizeLimits
): boolean =>
  fileCount <= getMaxFiles(limits) && diffBytes <= getMaxDiffBytes(limits);

/**
 * Split a batch that exceeds maxDiffBytes into smaller batches (recursive halving).
 */
const shrinkOversizedBatch = async (
  files: string[],
  limits: CommitSizeLimits,
  measureDiffBytes: MeasureDiffBytes
): Promise<string[][]> => {
  const diffBytes = await measureDiffBytes(files);

  if (batchFitsLimits(files.length, diffBytes, limits)) {
    return [files];
  }

  if (files.length <= 1) {
    return [files];
  }

  const mid = Math.ceil(files.length / 2);
  const left = await shrinkOversizedBatch(
    files.slice(0, mid),
    limits,
    measureDiffBytes
  );
  const right = await shrinkOversizedBatch(
    files.slice(mid),
    limits,
    measureDiffBytes
  );

  return [...left, ...right];
};

/**
 * Group staged files into commits that respect CMT_MAX_FILES and CMT_MAX_DIFF_BYTES.
 */
export const planCommitBatches = async (
  files: string[],
  limits: CommitSizeLimits,
  measureDiffBytes: MeasureDiffBytes
): Promise<string[][]> => {
  if (files.length === 0) {
    return [];
  }

  const maxFiles = getMaxFiles(limits);
  const maxDiffBytes = getMaxDiffBytes(limits);

  const fileDiffBytes = new Map<string, number>();
  for (const file of files) {
    fileDiffBytes.set(file, await measureDiffBytes([file]));
  }

  const roughBatches: string[][] = [];
  let currentBatch: string[] = [];
  let currentRoughBytes = 0;

  for (const file of files) {
    const fileBytes = fileDiffBytes.get(file) ?? 0;
    const nextCount = currentBatch.length + 1;
    const nextRoughBytes = currentRoughBytes + fileBytes;

    const wouldExceedFiles = nextCount > maxFiles;
    const wouldExceedBytes = nextRoughBytes > maxDiffBytes;

    if (currentBatch.length > 0 && (wouldExceedFiles || wouldExceedBytes)) {
      roughBatches.push(currentBatch);
      currentBatch = [file];
      currentRoughBytes = fileBytes;
    } else {
      currentBatch.push(file);
      currentRoughBytes = nextRoughBytes;
    }
  }

  if (currentBatch.length > 0) {
    roughBatches.push(currentBatch);
  }

  const finalBatches: string[][] = [];
  for (const batch of roughBatches) {
    const shrunk = await shrinkOversizedBatch(batch, limits, measureDiffBytes);
    finalBatches.push(...shrunk);
  }

  return finalBatches;
};
