import {
  CONFIG_KEYS,
  getConfig,
  CMT_AI_PROVIDER_ENUM,
  setConfig
} from '../commands/config';

export default function () {
  const config = getConfig({ setDefaultValues: false });

  const aiProvider = config.CMT_AI_PROVIDER;

  let apiKey: string | undefined;
  let apiUrl: string | undefined;

  if (aiProvider === CMT_AI_PROVIDER_ENUM.OLLAMA) {
    apiKey = config['CMT_OLLAMA_API_KEY'];
    apiUrl = config['CMT_OLLAMA_API_URL'];
  } else if (aiProvider === CMT_AI_PROVIDER_ENUM.ANTHROPIC) {
    apiKey = config['CMT_ANTHROPIC_API_KEY'];
    apiUrl = config['CMT_ANTHROPIC_BASE_PATH'];
  } else if (aiProvider === CMT_AI_PROVIDER_ENUM.OPENAI) {
    apiKey = config['CMT_OPENAI_API_KEY'];
    apiUrl = config['CMT_OPENAI_BASE_PATH'];
  } else if (aiProvider === CMT_AI_PROVIDER_ENUM.AZURE) {
    apiKey = config['CMT_AZURE_API_KEY'];
    apiUrl = config['CMT_AZURE_ENDPOINT'];
  } else if (aiProvider === CMT_AI_PROVIDER_ENUM.GEMINI) {
    apiKey = config['CMT_GEMINI_API_KEY'];
    apiUrl = config['CMT_GEMINI_BASE_PATH'];
  } else if (aiProvider === CMT_AI_PROVIDER_ENUM.FLOWISE) {
    apiKey = config['CMT_FLOWISE_API_KEY'];
    apiUrl = config['CMT_FLOWISE_ENDPOINT'];
  } else {
    throw new Error(
      `Migration failed, set AI provider first. Run "cmt config set CMT_AI_PROVIDER=<provider>", where <provider> is one of: ${Object.values(
        CMT_AI_PROVIDER_ENUM
      ).join(', ')}`
    );
  }

  if (apiKey) setConfig([[CONFIG_KEYS.CMT_API_KEY, apiKey]]);

  if (apiUrl) setConfig([[CONFIG_KEYS.CMT_API_URL, apiUrl]]);
}
