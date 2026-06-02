import { getConfig } from '../commands/config';

export interface CommitSizeLimits {
  maxFiles?: number;
  maxDiffBytes?: number;
}

export const checkCommitSizeGuardrails = (
  stagedFileCount: number,
  diffByteLength: number,
  limits: CommitSizeLimits
): void => {
  const { maxFiles, maxDiffBytes } = limits;

  if (
    maxFiles !== undefined &&
    typeof maxFiles === 'number' &&
    stagedFileCount > maxFiles
  ) {
    throw new Error(
      `Too many staged files (${stagedFileCount}). Maximum allowed: ${maxFiles}. ` +
        'Use `cmt` to split into multiple commits automatically, stage fewer files, or adjust with: cmt config set CMT_MAX_FILES=<number>'
    );
  }

  if (
    maxDiffBytes !== undefined &&
    typeof maxDiffBytes === 'number' &&
    diffByteLength > maxDiffBytes
  ) {
    throw new Error(
      `Staged diff is too large (${diffByteLength} bytes). Maximum allowed: ${maxDiffBytes} bytes. ` +
        'Split your commit or adjust with: cmt config set CMT_MAX_DIFF_BYTES=<number>'
    );
  }
};

export const getCommitSizeLimits = (): CommitSizeLimits => {
  const config = getConfig();

  return {
    maxFiles: config.CMT_MAX_FILES,
    maxDiffBytes: config.CMT_MAX_DIFF_BYTES
  };
};

export const assertCommitSizeGuardrails = (
  stagedFileCount: number,
  diffByteLength: number
): void => {
  checkCommitSizeGuardrails(stagedFileCount, diffByteLength, getCommitSizeLimits());
};

export const exceedsMaxStagedFiles = (
  stagedFileCount: number,
  limits: CommitSizeLimits = getCommitSizeLimits()
): boolean =>
  limits.maxFiles !== undefined &&
  typeof limits.maxFiles === 'number' &&
  stagedFileCount > limits.maxFiles;
