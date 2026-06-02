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
        'Unstage some files or split into multiple commits. ' +
        'Adjust with: cmt config set CMT_MAX_FILES=<number>'
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

export const assertCommitSizeGuardrails = (
  stagedFileCount: number,
  diffByteLength: number
): void => {
  const config = getConfig();

  checkCommitSizeGuardrails(stagedFileCount, diffByteLength, {
    maxFiles: config.CMT_MAX_FILES,
    maxDiffBytes: config.CMT_MAX_DIFF_BYTES
  });
};
