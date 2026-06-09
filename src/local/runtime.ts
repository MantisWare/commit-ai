export type LocalRuntime = 'mlx' | 'gguf';

export type LocalRuntimeOverride = 'auto' | LocalRuntime;

export const detectRuntime = (
  override: LocalRuntimeOverride = 'auto'
): LocalRuntime => {
  if (override === 'mlx' || override === 'gguf') {
    return override;
  }

  if (process.platform === 'darwin' && process.arch === 'arm64') {
    return 'mlx';
  }

  return 'gguf';
};

export const getRuntimeDisplayName = (runtime: LocalRuntime): string => {
  return runtime === 'mlx' ? 'MLX' : 'GGUF';
};

export const resolveLocalRuntimeOverride = (
  value: string | undefined
): LocalRuntimeOverride => {
  if (value === 'mlx' || value === 'gguf' || value === 'auto') {
    return value;
  }
  return 'auto';
};
