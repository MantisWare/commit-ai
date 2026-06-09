import { existsSync } from 'fs';
import { execa } from 'execa';
import type { LocalModelPreset } from './modelPresets';
import type { LocalRuntime } from './runtime';
import { getGgufModelPath, ensureLocalDirs, LOCAL_GGUF_DIR } from './paths';
import { getModelSourceForRuntime } from './modelPresets';
import type { OnEngineStatus } from './types';

export const isGgufModelDownloaded = (preset: LocalModelPreset): boolean => {
  return existsSync(getGgufModelPath(preset.gguf.file));
};

export const downloadGgufModel = async (
  preset: LocalModelPreset,
  onStatus?: OnEngineStatus
): Promise<string> => {
  ensureLocalDirs();
  const targetPath = getGgufModelPath(preset.gguf.file);

  if (existsSync(targetPath) === true) {
    return targetPath;
  }

  onStatus?.({
    phase: 'downloading',
    modelLabel: `${preset.label} (${preset.gguf.quantLabel})`,
    runtime: 'gguf'
  });

  try {
    const { importNodeLlamaCpp } = await import('./importNodeLlamaCpp');
    const nodeLlamaCpp = await importNodeLlamaCpp();
    const resolvedPath = await nodeLlamaCpp.resolveModelFile(
      preset.gguf.file,
      preset.gguf.repo
    );

    if (existsSync(resolvedPath) === true) {
      return resolvedPath;
    }
  } catch {
    // Fall through to huggingface-cli if node-llama-cpp downloader unavailable
  }

  await execa(
    'huggingface-cli',
    [
      'download',
      preset.gguf.repo,
      preset.gguf.file,
      '--local-dir',
      LOCAL_GGUF_DIR,
      '--local-dir-use-symlinks',
      'False'
    ],
    { stdio: 'inherit' }
  );

  return targetPath;
};

export const prefetchMlxModel = async (
  preset: LocalModelPreset,
  onStatus?: OnEngineStatus
): Promise<string> => {
  const source = getModelSourceForRuntime(preset, 'mlx');

  onStatus?.({
    phase: 'downloading',
    modelLabel: `${preset.label} (${source.quantLabel})`,
    runtime: 'mlx'
  });

  await execa(
    'python3',
    [
      '-m',
      'mlx_lm',
      'generate',
      '--model',
      source.repo,
      '--prompt',
      'test',
      '--max-tokens',
      '1'
    ],
    { stdio: 'pipe' }
  ).catch(() => {
    // mlx-lm downloads on server start; prefetch is best-effort
  });

  return source.repo;
};

export const downloadModelForRuntime = async (
  preset: LocalModelPreset,
  runtime: LocalRuntime,
  onStatus?: OnEngineStatus
): Promise<string> => {
  if (runtime === 'mlx') {
    return prefetchMlxModel(preset, onStatus);
  }
  return downloadGgufModel(preset, onStatus);
};
