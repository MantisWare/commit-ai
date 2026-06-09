import type { LocalRuntime } from './runtime';
import type { LocalModelPresetId } from './modelPresets';

export type EngineStatusPhase =
  | 'checking_runtime'
  | 'downloading'
  | 'loading_model'
  | 'starting_daemon'
  | 'connecting_daemon'
  | 'ready'
  | 'fallback_cloud';

export interface EngineStatus {
  phase: EngineStatusPhase;
  modelLabel?: string;
  runtime?: LocalRuntime;
  port?: number;
  cause?: unknown;
}

export type OnEngineStatus = (status: EngineStatus) => void;

export interface LocalDaemonInfo {
  pid: number;
  port: number;
  runtime: LocalRuntime;
  preset: LocalModelPresetId;
  startedAt: string;
  lastActivityAt: string;
}

export interface LocalEngineOptions {
  preset?: LocalModelPresetId;
  runtime?: 'auto' | LocalRuntime;
  contextSize?: number;
  gpuLayers?: number;
  daemonPort?: number;
  preferDaemon?: boolean;
  onStatus?: OnEngineStatus;
}
