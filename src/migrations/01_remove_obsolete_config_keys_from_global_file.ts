import { getGlobalConfig, setGlobalConfig } from '../commands/config';

export default function () {
  const obsoleteKeys = [
    'CMT_OLLAMA_API_KEY',
    'CMT_OLLAMA_API_URL',
    'CMT_ANTHROPIC_API_KEY',
    'CMT_ANTHROPIC_BASE_PATH',
    'CMT_OPENAI_API_KEY',
    'CMT_OPENAI_BASE_PATH',
    'CMT_AZURE_API_KEY',
    'CMT_AZURE_ENDPOINT',
    'CMT_GEMINI_API_KEY',
    'CMT_GEMINI_BASE_PATH',
    'CMT_FLOWISE_API_KEY',
    'CMT_FLOWISE_ENDPOINT'
  ];

  const globalConfig = getGlobalConfig();

  const configToOverride = { ...globalConfig };

  for (const key of obsoleteKeys) delete configToOverride[key];

  setGlobalConfig(configToOverride);
}
