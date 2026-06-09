import axios from 'axios';
import { OpenAI } from 'openai';
import { getConfig } from '../commands/config';
import {
  DEFAULT_DAEMON_PORT,
  getDaemonBaseUrl,
  getDaemonModelId,
  isDaemonRunning,
  touchDaemonActivity
} from '../local/daemon';
import { generateWithGguf, generateWithGgufDaemon } from '../local/ggufRuntime';
import { generateWithMlx, generateWithMlxDaemon } from '../local/mlxRuntime';
import {
  DEFAULT_LOCAL_PRESET,
  getModelDisplayLabel,
  isLocalModelPresetId,
  resolvePreset
} from '../local/modelPresets';
import { detectRuntime, resolveLocalRuntimeOverride } from '../local/runtime';
import type { OnEngineStatus } from '../local/types';
import { AiEngine, AiEngineConfig } from './Engine';

export interface LocalEngineConfig extends AiEngineConfig {
  onStatus?: OnEngineStatus;
}

export class LocalEngine implements AiEngine {
  config: LocalEngineConfig;
  client: typeof axios;

  constructor(config: LocalEngineConfig) {
    this.config = config;
    this.client = axios;
  }

  async generateCommitMessage(
    messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>
  ): Promise<string | undefined> {
    const appConfig = getConfig();
    const presetId = isLocalModelPresetId(appConfig.CMT_LOCAL_MODEL_PRESET)
      ? appConfig.CMT_LOCAL_MODEL_PRESET
      : DEFAULT_LOCAL_PRESET;
    const preset = resolvePreset(presetId);
    const runtime = detectRuntime(
      resolveLocalRuntimeOverride(appConfig.CMT_LOCAL_RUNTIME)
    );
    const modelLabel = getModelDisplayLabel(preset, runtime);
    const onStatus = this.config.onStatus;
    const daemonPort = appConfig.CMT_LOCAL_DAEMON_PORT ?? DEFAULT_DAEMON_PORT;
    const preferDaemon = appConfig.CMT_LOCAL_PREFER_DAEMON !== false;
    const contextSize = appConfig.CMT_LOCAL_CONTEXT_SIZE ?? 4096;
    const gpuLayers = appConfig.CMT_LOCAL_GPU_LAYERS ?? -1;
    const maxTokensOutput =
      this.config.maxTokensOutput ?? appConfig.CMT_TOKENS_MAX_OUTPUT ?? 512;

    onStatus?.({
      phase: 'checking_runtime',
      modelLabel,
      runtime
    });

    if (preferDaemon === true) {
      const daemonInfo = await isDaemonRunning(daemonPort);
      if (daemonInfo !== undefined) {
        onStatus?.({
          phase: 'connecting_daemon',
          modelLabel,
          runtime: daemonInfo.runtime,
          port: daemonInfo.port
        });

        touchDaemonActivity();

        const baseUrl = getDaemonBaseUrl(daemonInfo.port);
        const modelId = getDaemonModelId(preset, daemonInfo.runtime);

        const result =
          daemonInfo.runtime === 'mlx'
            ? await generateWithMlxDaemon(messages, {
                baseUrl,
                model: modelId,
                maxTokensOutput
              })
            : await generateWithGgufDaemon(messages, {
                baseUrl,
                model: modelId,
                maxTokensOutput
              });

        onStatus?.({ phase: 'ready', modelLabel, runtime: daemonInfo.runtime });
        return result;
      }
    }

    if (runtime === 'mlx') {
      return generateWithMlx(messages, {
        preset,
        maxTokensOutput,
        onStatus
      });
    }

    return generateWithGguf(messages, {
      preset,
      contextSize,
      gpuLayers,
      maxTokensOutput,
      onStatus
    });
  }
}
