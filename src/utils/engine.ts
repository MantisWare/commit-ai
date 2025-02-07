import { getConfig, CMT_AI_PROVIDER_ENUM } from '../commands/config';
import { AnthropicEngine } from '../engine/anthropic';
import { AzureEngine } from '../engine/azure';
import { AiEngine } from '../engine/Engine';
import { FlowiseEngine } from '../engine/flowise';
import { GeminiEngine } from '../engine/gemini';
import { OllamaEngine } from '../engine/ollama';
import { OpenAiEngine } from '../engine/openAi';
import { MistralAiEngine } from '../engine/mistral';
import { TestAi, TestMockType } from '../engine/testAi';
import { GroqEngine } from '../engine/groq';
import { MLXEngine } from '../engine/mlx';
import { DeepseekEngine } from '../engine/deepseek';

export function getEngine(): AiEngine {
  const config = getConfig();
  const provider = config.CMT_AI_PROVIDER;

  const DEFAULT_CONFIG = {
    model: config.CMT_MODEL!,
    maxTokensOutput: config.CMT_TOKENS_MAX_OUTPUT!,
    maxTokensInput: config.CMT_TOKENS_MAX_INPUT!,
    baseURL: config.CMT_API_URL!,
    apiKey: config.CMT_API_KEY!
  };

  switch (provider) {
    case CMT_AI_PROVIDER_ENUM.OLLAMA:
      return new OllamaEngine(DEFAULT_CONFIG);

    case CMT_AI_PROVIDER_ENUM.ANTHROPIC:
      return new AnthropicEngine(DEFAULT_CONFIG);

    case CMT_AI_PROVIDER_ENUM.TEST:
      return new TestAi(config.CMT_TEST_MOCK_TYPE as TestMockType);

    case CMT_AI_PROVIDER_ENUM.GEMINI:
      return new GeminiEngine(DEFAULT_CONFIG);

    case CMT_AI_PROVIDER_ENUM.AZURE:
      return new AzureEngine(DEFAULT_CONFIG);

    case CMT_AI_PROVIDER_ENUM.FLOWISE:
      return new FlowiseEngine(DEFAULT_CONFIG);

    case CMT_AI_PROVIDER_ENUM.GROQ:
      return new GroqEngine(DEFAULT_CONFIG);

    case CMT_AI_PROVIDER_ENUM.MISTRAL:
      return new MistralAiEngine(DEFAULT_CONFIG);

    case CMT_AI_PROVIDER_ENUM.MLX:
      return new MLXEngine(DEFAULT_CONFIG);

    case CMT_AI_PROVIDER_ENUM.DEEPSEEK:
      return new DeepseekEngine(DEFAULT_CONFIG);

    default:
      return new OpenAiEngine(DEFAULT_CONFIG);
  }
}
