import type { EngineStatus } from './types';
import { getRuntimeDisplayName } from './runtime';

export const formatEngineStatusLabel = (status: EngineStatus): string => {
  const model = status.modelLabel ?? 'local model';
  const runtimeName =
    status.runtime !== undefined
      ? getRuntimeDisplayName(status.runtime)
      : 'local';

  switch (status.phase) {
    case 'checking_runtime':
      return `Checking local runtime (${runtimeName})…`;
    case 'downloading':
      return `Downloading ${model}…`;
    case 'loading_model':
      return `Warming up 🔥 ${model}…`;
    case 'starting_daemon':
      return `Starting local server — ${model}…`;
    case 'connecting_daemon': {
      const portSuffix =
        status.port !== undefined ? `:${status.port}` : '';
      return `Connecting to local daemon on ${portSuffix}…`;
    }
    case 'ready':
      return 'Local model ready';
    case 'fallback_cloud': {
      const causeMessage = formatCause(status.cause);
      const suffix =
        causeMessage !== undefined ? ` (${causeMessage})` : '';
      return `⚠ Falling back to ${model}${suffix}…`;
    }
    default:
      return `Warming up ${model}…`;
  }
};

const formatCause = (cause: unknown): string | undefined => {
  if (cause instanceof Error) {
    return cause.message;
  }
  if (typeof cause === 'string') {
    return cause;
  }
  return undefined;
};
