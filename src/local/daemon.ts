import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { execa } from 'execa';
import type { LocalModelPreset, LocalModelPresetId } from './modelPresets';
import { resolvePreset } from './modelPresets';
import { detectRuntime, type LocalRuntime } from './runtime';
import {
  LOCAL_DAEMON_FILE,
  ensureLocalDirs
} from './paths';
import type { LocalDaemonInfo } from './types';
import { checkServerHealth } from './chatCompletions';
import { startGgufDaemonServer } from './ggufDaemonServer';
import { spawnMlxDaemon } from './mlxRuntime';

export const DEFAULT_DAEMON_PORT = 11_435;

export const readDaemonInfo = (): LocalDaemonInfo | undefined => {
  if (existsSync(LOCAL_DAEMON_FILE) !== true) return undefined;
  try {
    return JSON.parse(
      readFileSync(LOCAL_DAEMON_FILE, 'utf8')
    ) as LocalDaemonInfo;
  } catch {
    return undefined;
  }
};

export const writeDaemonInfo = (info: LocalDaemonInfo): void => {
  ensureLocalDirs();
  writeFileSync(LOCAL_DAEMON_FILE, JSON.stringify(info, null, 2), 'utf8');
};

export const clearDaemonInfo = (): void => {
  if (existsSync(LOCAL_DAEMON_FILE) === true) {
    unlinkSync(LOCAL_DAEMON_FILE);
  }
};

export const isProcessAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

export const getDaemonBaseUrl = (port: number): string =>
  `http://127.0.0.1:${port}`;

export const isDaemonRunning = async (
  port: number = DEFAULT_DAEMON_PORT
): Promise<LocalDaemonInfo | undefined> => {
  const info = readDaemonInfo();
  if (info === undefined) return undefined;
  if (info.port !== port) return undefined;
  if (isProcessAlive(info.pid) !== true) {
    clearDaemonInfo();
    return undefined;
  }

  const healthy = await checkServerHealth(getDaemonBaseUrl(info.port));
  if (healthy !== true) return undefined;
  return info;
};

export const touchDaemonActivity = (): void => {
  const info = readDaemonInfo();
  if (info === undefined) return;
  writeDaemonInfo({
    ...info,
    lastActivityAt: new Date().toISOString()
  });
};

export interface StartDaemonOptions {
  presetId: LocalModelPresetId;
  runtime?: LocalRuntime;
  port?: number;
  contextSize?: number;
  gpuLayers?: number;
  maxTokensOutput?: number;
  idleTimeoutSeconds?: number;
  background?: boolean;
}

export const startDaemon = async (
  options: StartDaemonOptions
): Promise<{ info: LocalDaemonInfo; process?: ReturnType<typeof execa> }> => {
  const runtime = options.runtime ?? detectRuntime('auto');
  const port = options.port ?? DEFAULT_DAEMON_PORT;
  const preset = resolvePreset(options.presetId);
  const existing = await isDaemonRunning(port);

  if (existing !== undefined) {
    return { info: existing };
  }

  const startedAt = new Date().toISOString();

  if (runtime === 'mlx') {
    const serverProcess = spawnMlxDaemon(
      preset.mlx.repo,
      port,
      options.background === true
    );
    serverProcess.catch(() => undefined);

    if (options.background === true && serverProcess.pid !== undefined) {
      serverProcess.unref?.();
    }

    const initiallyHealthy = await checkServerHealth(
      getDaemonBaseUrl(port),
      5_000
    );
    if (initiallyHealthy !== true) {
      await waitForDaemon(port);
    }

    const info: LocalDaemonInfo = {
      pid: serverProcess.pid ?? process.pid,
      port,
      runtime,
      preset: options.presetId,
      startedAt,
      lastActivityAt: startedAt
    };
    writeDaemonInfo(info);
    return { info, process: serverProcess };
  }

  if (options.background === true) {
    throw new Error(
      'GGUF background daemon must be started via "cmt local serve" in this process.'
    );
  }

  const server = await startGgufDaemonServer({
    preset,
    port,
    contextSize: options.contextSize ?? 4096,
    gpuLayers: options.gpuLayers ?? -1,
    maxTokensOutput: options.maxTokensOutput ?? 512,
    idleTimeoutSeconds: options.idleTimeoutSeconds ?? 1800,
    onActivity: touchDaemonActivity
  });

  const info: LocalDaemonInfo = {
    pid: process.pid,
    port,
    runtime: 'gguf',
    preset: options.presetId,
    startedAt,
    lastActivityAt: startedAt
  };
  writeDaemonInfo(info);

  server.on('close', () => {
    clearDaemonInfo();
  });

  return { info };
};

const waitForDaemon = async (
  port: number,
  timeoutMs = 120_000
): Promise<void> => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const healthy = await checkServerHealth(getDaemonBaseUrl(port));
    if (healthy === true) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Daemon failed to start on port ${port}`);
};

export const stopDaemon = async (): Promise<boolean> => {
  const info = readDaemonInfo();
  if (info === undefined) return false;

  if (isProcessAlive(info.pid) === true) {
    try {
      process.kill(info.pid, 'SIGTERM');
    } catch {
      // process may have already exited
    }
  }

  clearDaemonInfo();
  return true;
};

export const getDaemonModelId = (
  preset: LocalModelPreset,
  runtime: LocalRuntime
): string => {
  return runtime === 'mlx' ? preset.mlx.repo : preset.gguf.file;
};
