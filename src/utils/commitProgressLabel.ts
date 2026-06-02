import type { GenerateCommitProgress } from '../generateCommitMessageFromGitDiff';

export const formatCommitProgressLabel = (
  baseLabel: string,
  progress: GenerateCommitProgress
): string => {
  if (progress.phase === 'preparing') {
    const completed = progress.completed ?? 0;
    const total = progress.total;
    if (total !== undefined && total > 0) {
      return `${baseLabel} — preparing chunks (${completed}/${total})`;
    }
    return `${baseLabel} — preparing chunks`;
  }

  if (progress.phase === 'generating') {
    const completed = progress.completed ?? 0;
    const total = progress.total;
    if (total !== undefined && total > 0) {
      return `${baseLabel} — generating chunk ${completed}/${total}`;
    }
    return `${baseLabel} — generating chunks`;
  }

  return `${baseLabel} — synthesizing commit message`;
};
