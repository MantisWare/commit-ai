import {
  getConfig,
  CMT_AI_PROVIDER_ENUM,
  type ConfigType
} from '../commands/config';
import { AnthropicEngine } from '../engine/anthropic';
import { AzureEngine } from '../engine/azure';
import { AiEngine, AiEngineConfig } from '../engine/Engine';
import { FallbackEngine } from '../engine/fallback';
import { FlowiseEngine } from '../engine/flowise';
import { GeminiEngine } from '../engine/gemini';
import { LocalEngine } from '../engine/local';
import { OllamaEngine } from '../engine/ollama';
import { OpenAiEngine } from '../engine/openAi';
import { MistralAiEngine } from '../engine/mistral';
import { TestAi, TestMockType } from '../engine/testAi';
import { GroqEngine } from '../engine/groq';
import { MLXEngine } from '../engine/mlx';
import { DeepseekEngine } from '../engine/deepseek';
import type { OnEngineStatus } from '../local/types';

/**
 * Per-run engine selection override. Lets the user flip between their local and
 * cloud models for a single invocation without changing CMT_AI_PROVIDER.
 */
export type EngineOverride = 'local' | 'cloud';

export interface GetEngineOptions {
  onStatus?: OnEngineStatus;
  /**
   * Force a specific engine for this call. When omitted, the process-level
   * override (see {@link setEngineOverride}) is used, then CMT_AI_PROVIDER.
   */
  engineOverride?: EngineOverride;
}

let processEngineOverride: EngineOverride | undefined;

/**
 * Sets a process-wide engine override, applied by every subsequent getEngine
 * call that doesn't pass its own. Intended to be set once from CLI flags.
 */
export const setEngineOverride = (
  override: EngineOverride | undefined
): void => {
  processEngineOverride = override;
};

export const getEngineOverride = (): EngineOverride | undefined =>
  processEngineOverride;

/**
 * Resolves the requested engine override from mutually-exclusive CLI flags.
 * Throws when both are supplied so the caller can surface a clear error.
 */
export const resolveEngineOverrideFromFlags = (flags: {
  local?: boolean;
  cloud?: boolean;
}): EngineOverride | undefined => {
  const wantsLocal = flags.local === true;
  const wantsCloud = flags.cloud === true;

  if (wantsLocal === true && wantsCloud === true) {
    throw new Error(
      'Cannot use --local and --cloud together. Pick one engine for this run.'
    );
  }

  if (wantsLocal === true) return 'local';
  if (wantsCloud === true) return 'cloud';
  return undefined;
};

/**
 * Whether a cloud model is configured well enough to run (an API key exists).
 * Unlike CMT_LOCAL_CLOUD_FALLBACK, this ignores the automatic-fallback toggle
 * because an explicit --cloud request is a deliberate user choice.
 */
export const hasCloudModelConfigured = (config: ConfigType): boolean => {
  const apiKey = config.CMT_LOCAL_FALLBACK_API_KEY ?? config.CMT_API_KEY ?? '';
  return apiKey.length > 0;
};

const buildEngineConfig = (
  config: ConfigType,
  onStatus?: OnEngineStatus
): AiEngineConfig => ({
  model: config.CMT_MODEL ?? '',
  maxTokensOutput: config.CMT_TOKENS_MAX_OUTPUT ?? 512,
  maxTokensInput: config.CMT_TOKENS_MAX_INPUT ?? 4096,
  baseURL: config.CMT_API_URL ?? '',
  apiKey: config.CMT_API_KEY ?? '',
  onStatus
});

const createProviderEngine = (
  provider: CMT_AI_PROVIDER_ENUM,
  engineConfig: AiEngineConfig,
  config: ConfigType
): AiEngine => {
  switch (provider) {
    case CMT_AI_PROVIDER_ENUM.OLLAMA:
      return new OllamaEngine(engineConfig);

    case CMT_AI_PROVIDER_ENUM.ANTHROPIC:
      return new AnthropicEngine(engineConfig);

    case CMT_AI_PROVIDER_ENUM.TEST:
      return new TestAi(config.CMT_TEST_MOCK_TYPE as TestMockType);

    case CMT_AI_PROVIDER_ENUM.GEMINI:
      return new GeminiEngine(engineConfig);

    case CMT_AI_PROVIDER_ENUM.AZURE:
      return new AzureEngine(engineConfig);

    case CMT_AI_PROVIDER_ENUM.FLOWISE:
      return new FlowiseEngine(engineConfig);

    case CMT_AI_PROVIDER_ENUM.GROQ:
      return new GroqEngine(engineConfig);

    case CMT_AI_PROVIDER_ENUM.MISTRAL:
      return new MistralAiEngine(engineConfig);

    case CMT_AI_PROVIDER_ENUM.MLX:
      return new MLXEngine(engineConfig);

    case CMT_AI_PROVIDER_ENUM.DEEPSEEK:
      return new DeepseekEngine(engineConfig);

    case CMT_AI_PROVIDER_ENUM.LOCAL:
      return new LocalEngine(engineConfig);

    default:
      return new OpenAiEngine(engineConfig);
  }
};

const createFallbackEngine = (
  config: ConfigType,
  onStatus?: OnEngineStatus
): AiEngine => {
  const fallbackProvider =
    config.CMT_LOCAL_FALLBACK_PROVIDER ?? CMT_AI_PROVIDER_ENUM.OPENAI;
  const fallbackModel =
    config.CMT_LOCAL_FALLBACK_MODEL ?? 'gpt-4o-mini';
  const fallbackConfig: AiEngineConfig = {
    model: fallbackModel,
    maxTokensOutput: config.CMT_TOKENS_MAX_OUTPUT ?? 512,
    maxTokensInput: config.CMT_TOKENS_MAX_INPUT ?? 4096,
    baseURL:
      config.CMT_LOCAL_FALLBACK_API_URL ??
      config.CMT_API_URL ??
      '',
    apiKey:
      config.CMT_LOCAL_FALLBACK_API_KEY ??
      config.CMT_API_KEY ??
      '',
    onStatus
  };

  return createProviderEngine(
    fallbackProvider as CMT_AI_PROVIDER_ENUM,
    fallbackConfig,
    config
  );
};

const canUseCloudFallback = (config: ConfigType): boolean => {
  if (config.CMT_LOCAL_CLOUD_FALLBACK === false) return false;
  const apiKey =
    config.CMT_LOCAL_FALLBACK_API_KEY ?? config.CMT_API_KEY ?? '';
  return apiKey.length > 0;
};

/**
 * Builds the local engine, wrapping it with the configured cloud fallback when
 * one is available (mirrors the default CMT_AI_PROVIDER=local behaviour).
 */
const buildLocalEngine = (
  config: ConfigType,
  onStatus?: OnEngineStatus
): AiEngine => {
  const localEngine = new LocalEngine(buildEngineConfig(config, onStatus));

  if (canUseCloudFallback(config) === true) {
    const fallbackModel = config.CMT_LOCAL_FALLBACK_MODEL ?? 'gpt-4o-mini';
    return new FallbackEngine(localEngine, createFallbackEngine(config, onStatus), {
      onStatus,
      fallbackModelLabel: fallbackModel
    });
  }

  return localEngine;
};

export function getEngine(options: GetEngineOptions = {}): AiEngine {
  const config = getConfig();
  const onStatus = options.onStatus;
  const override = options.engineOverride ?? processEngineOverride;
  const provider = config.CMT_AI_PROVIDER ?? CMT_AI_PROVIDER_ENUM.OPENAI;

  if (override === 'local') {
    return buildLocalEngine(config, onStatus);
  }

  if (override === 'cloud') {
    // When the base provider is local, the "cloud model" is the configured
    // fallback provider. Otherwise the base provider already is a cloud one.
    if (provider === CMT_AI_PROVIDER_ENUM.LOCAL) {
      return createFallbackEngine(config, onStatus);
    }
    return createProviderEngine(provider, buildEngineConfig(config, onStatus), config);
  }

  if (provider === CMT_AI_PROVIDER_ENUM.LOCAL) {
    return buildLocalEngine(config, onStatus);
  }

  return createProviderEngine(provider, buildEngineConfig(config, onStatus), config);
}
