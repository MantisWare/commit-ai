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

export interface GetEngineOptions {
  onStatus?: OnEngineStatus;
}

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

export function getEngine(options: GetEngineOptions = {}): AiEngine {
  const config = getConfig();
  const provider = config.CMT_AI_PROVIDER;
  const engineConfig = buildEngineConfig(config, options.onStatus);

  if (provider === CMT_AI_PROVIDER_ENUM.LOCAL) {
    const localEngine = new LocalEngine(engineConfig);
    if (canUseCloudFallback(config) === true) {
      const fallbackModel =
        config.CMT_LOCAL_FALLBACK_MODEL ?? 'gpt-4o-mini';
      return new FallbackEngine(
        localEngine,
        createFallbackEngine(config, options.onStatus),
        {
          onStatus: options.onStatus,
          fallbackModelLabel: fallbackModel
        }
      );
    }
    return localEngine;
  }

  return createProviderEngine(
    provider ?? CMT_AI_PROVIDER_ENUM.OPENAI,
    engineConfig,
    config
  );
}
