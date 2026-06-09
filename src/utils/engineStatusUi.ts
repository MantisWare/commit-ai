import type { OnEngineStatusCallback } from '../generateCommitMessageFromGitDiff';
import { formatEngineStatusLabel } from '../local/statusLabels';
import type { EngineStatus } from '../local/types';
import { startWarmupIndicator } from './warmupIndicator';

export interface EngineStatusUi {
  onEngineStatus: OnEngineStatusCallback;
  stop: () => void;
}

export const createEngineStatusUi = (
  updateLabel?: (label: string) => void
): EngineStatusUi => {
  const warmup = startWarmupIndicator();

  const onEngineStatus = (status: EngineStatus) => {
    if (status.phase === 'ready') {
      warmup.stop();
      return;
    }

    if (status.phase === 'fallback_cloud') {
      warmup.update(status);
      return;
    }

    warmup.update(status);

    if (updateLabel !== undefined) {
      updateLabel(formatEngineStatusLabel(status));
    }
  };

  return {
    onEngineStatus,
    stop: () => {
      warmup.stop();
    }
  };
};
