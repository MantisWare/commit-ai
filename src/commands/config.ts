import { intro, outro } from '@clack/prompts';
import chalk from 'chalk';
import { command } from 'cleye';
import * as dotenv from 'dotenv';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { parse as iniParse, stringify as iniStringify } from 'ini';
import { homedir } from 'os';
import { join as pathJoin, resolve as pathResolve } from 'path';
import { COMMANDS } from './ENUMS';
import { TEST_MOCK_TYPES } from '../engine/testAi';
import { getI18nLocal, i18n } from '../i18n';

export enum CONFIG_KEYS {
  CMT_API_KEY = 'CMT_API_KEY',
  CMT_TOKENS_MAX_INPUT = 'CMT_TOKENS_MAX_INPUT',
  CMT_TOKENS_MAX_OUTPUT = 'CMT_TOKENS_MAX_OUTPUT',
  CMT_DESCRIPTION = 'CMT_DESCRIPTION',
  CMT_EMOJI = 'CMT_EMOJI',
  CMT_MODEL = 'CMT_MODEL',
  CMT_LANGUAGE = 'CMT_LANGUAGE',
  CMT_WHY = 'CMT_WHY',
  CMT_MESSAGE_TEMPLATE_PLACEHOLDER = 'CMT_MESSAGE_TEMPLATE_PLACEHOLDER',
  CMT_PROMPT_MODULE = 'CMT_PROMPT_MODULE',
  CMT_AI_PROVIDER = 'CMT_AI_PROVIDER',
  CMT_ONE_LINE_COMMIT = 'CMT_ONE_LINE_COMMIT',
  CMT_TEST_MOCK_TYPE = 'CMT_TEST_MOCK_TYPE',
  CMT_API_URL = 'CMT_API_URL',
  CMT_DEBUG = 'CMT_DEBUG',
  CMT_MAX_FILES = 'CMT_MAX_FILES',
  CMT_MAX_DIFF_BYTES = 'CMT_MAX_DIFF_BYTES',
  CMT_LARGE_FILE_DIFF_BYTES = 'CMT_LARGE_FILE_DIFF_BYTES',
  CMT_CHUNK_CONCURRENCY = 'CMT_CHUNK_CONCURRENCY',
  CMT_SYNTHESIZE_CHUNKS = 'CMT_SYNTHESIZE_CHUNKS',
  CMT_SML = 'CMT_SML',
  CMT_REVIEW_MIN_SCORE = 'CMT_REVIEW_MIN_SCORE',
  CMT_GITPUSH = 'CMT_GITPUSH', // todo: deprecate
  CMT_AUTO_UPDATE = 'CMT_AUTO_UPDATE',
  CMT_LOCAL_MODEL_PRESET = 'CMT_LOCAL_MODEL_PRESET',
  CMT_LOCAL_RUNTIME = 'CMT_LOCAL_RUNTIME',
  CMT_LOCAL_CONTEXT_SIZE = 'CMT_LOCAL_CONTEXT_SIZE',
  CMT_LOCAL_GPU_LAYERS = 'CMT_LOCAL_GPU_LAYERS',
  CMT_LOCAL_DAEMON_PORT = 'CMT_LOCAL_DAEMON_PORT',
  CMT_LOCAL_IDLE_TIMEOUT = 'CMT_LOCAL_IDLE_TIMEOUT',
  CMT_LOCAL_PREFER_DAEMON = 'CMT_LOCAL_PREFER_DAEMON',
  CMT_LOCAL_CLOUD_FALLBACK = 'CMT_LOCAL_CLOUD_FALLBACK',
  CMT_LOCAL_FALLBACK_PROVIDER = 'CMT_LOCAL_FALLBACK_PROVIDER',
  CMT_LOCAL_FALLBACK_MODEL = 'CMT_LOCAL_FALLBACK_MODEL',
  CMT_LOCAL_FALLBACK_API_KEY = 'CMT_LOCAL_FALLBACK_API_KEY',
  CMT_LOCAL_FALLBACK_API_URL = 'CMT_LOCAL_FALLBACK_API_URL'
}

export enum CONFIG_MODES {
  get = 'get',
  set = 'set'
}

export const MODEL_LIST = {
  openai: [
    'gpt-4o-mini',
    'gpt-3.5-turbo',
    'gpt-3.5-turbo-instruct',
    'gpt-3.5-turbo-0613',
    'gpt-3.5-turbo-0301',
    'gpt-3.5-turbo-1106',
    'gpt-3.5-turbo-0125',
    'gpt-3.5-turbo-16k',
    'gpt-3.5-turbo-16k-0613',
    'gpt-3.5-turbo-16k-0301',
    'gpt-4',
    'gpt-4-0314',
    'gpt-4-0613',
    'gpt-4-1106-preview',
    'gpt-4-0125-preview',
    'gpt-4-turbo-preview',
    'gpt-4-vision-preview',
    'gpt-4-1106-vision-preview',
    'gpt-4-turbo',
    'gpt-4-turbo-2024-04-09',
    'gpt-4-32k',
    'gpt-4-32k-0314',
    'gpt-4-32k-0613',
    'gpt-4o',
    'gpt-4o-2024-05-13',
    'gpt-4o-mini-2024-07-18'
  ],

  anthropic: [
    'claude-3-5-sonnet-20240620',
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307'
  ],

  gemini: [
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-1.0-pro',
    'gemini-pro-vision',
    'text-embedding-004'
  ],

  groq: [
    'llama3-70b-8192', // Meta Llama 3 70B (default one, no daily token limit and 14 400 reqs/day)
    'llama3-8b-8192', // Meta Llama 3 8B
    'llama-guard-3-8b', // Llama Guard 3 8B
    'llama-3.1-8b-instant', // Llama 3.1 8B (Preview)
    'llama-3.1-70b-versatile', // Llama 3.1 70B (Preview)
    'gemma-7b-it', // Gemma 7B
    'gemma2-9b-it' // Gemma 2 9B
  ],

  mistral: [
    'ministral-3b-2410',
    'ministral-3b-latest',
    'ministral-8b-2410',
    'ministral-8b-latest',
    'open-mistral-7b',
    'mistral-tiny',
    'mistral-tiny-2312',
    'open-mistral-nemo',
    'open-mistral-nemo-2407',
    'mistral-tiny-2407',
    'mistral-tiny-latest',
    'open-mixtral-8x7b',
    'mistral-small',
    'mistral-small-2312',
    'open-mixtral-8x22b',
    'open-mixtral-8x22b-2404',
    'mistral-small-2402',
    'mistral-small-2409',
    'mistral-small-latest',
    'mistral-medium-2312',
    'mistral-medium',
    'mistral-medium-latest',
    'mistral-large-2402',
    'mistral-large-2407',
    'mistral-large-2411',
    'mistral-large-latest',
    'pixtral-large-2411',
    'pixtral-large-latest',
    'codestral-2405',
    'codestral-latest',
    'codestral-mamba-2407',
    'open-codestral-mamba',
    'codestral-mamba-latest',
    'pixtral-12b-2409',
    'pixtral-12b',
    'pixtral-12b-latest',
    'mistral-embed',
    'mistral-moderation-2411',
    'mistral-moderation-latest',
  ],
  deepseek: [
    'deepseek-chat',
    'deepseek-coder',
    'deepseek-coder-v2-lite-instruct-mlx',
    'deepseek-reasoner'
  ]
};

const getDefaultModel = (provider: string | undefined): string => {
  switch (provider) {
    case 'ollama':
      return '';
    case 'mlx':
      return '';
    case 'anthropic':
      return MODEL_LIST.anthropic[0];
    case 'gemini':
      return MODEL_LIST.gemini[0];
    case 'groq':
      return MODEL_LIST.groq[0];
    case 'mistral':
      return MODEL_LIST.mistral[0];
    case 'deepseek':
      return MODEL_LIST.deepseek[0];
    default:
      return MODEL_LIST.openai[0];
  }
};

const validateConfig = (
  key: string,
  condition: any,
  validationMessage: string
) => {
  if (!condition) {
    outro(`${chalk.red('✖')} wrong value for ${key}: ${validationMessage}.`);

    outro(
      'For more help refer to docs https://github.com/MantisWare/commit-ai'
    );

    process.exit(1);
  }
};

export const configValidators = {
  [CONFIG_KEYS.CMT_API_KEY](value: any, config: any = {}) {
    if (config.CMT_AI_PROVIDER !== 'openai') return value;

    validateConfig(
      'CMT_API_KEY',
      typeof value === 'string' && value.length > 0,
      'Empty value is not allowed'
    );

    validateConfig(
      'CMT_API_KEY',
      value,
      'You need to provide the CMT_API_KEY when CMT_AI_PROVIDER set to "openai" (default) or "ollama" or "mlx" or "azure" or "gemini" or "flowise" or "anthropic" or "deepseek". Run `cmt config set CMT_API_KEY=your_key CMT_AI_PROVIDER=openai`'
    );

    return value;
  },

  [CONFIG_KEYS.CMT_DESCRIPTION](value: any) {
    validateConfig(
      CONFIG_KEYS.CMT_DESCRIPTION,
      typeof value === 'boolean',
      'Must be boolean: true or false'
    );

    return value;
  },

  [CONFIG_KEYS.CMT_TOKENS_MAX_INPUT](value: any) {
    value = parseInt(value);
    validateConfig(
      CONFIG_KEYS.CMT_TOKENS_MAX_INPUT,
      !isNaN(value),
      'Must be a number'
    );

    return value;
  },

  [CONFIG_KEYS.CMT_TOKENS_MAX_OUTPUT](value: any) {
    value = parseInt(value);
    validateConfig(
      CONFIG_KEYS.CMT_TOKENS_MAX_OUTPUT,
      !isNaN(value),
      'Must be a number'
    );

    return value;
  },

  [CONFIG_KEYS.CMT_EMOJI](value: any) {
    validateConfig(
      CONFIG_KEYS.CMT_EMOJI,
      typeof value === 'boolean',
      'Must be boolean: true or false'
    );

    return value;
  },

  [CONFIG_KEYS.CMT_LANGUAGE](value: any) {
    const supportedLanguages = Object.keys(i18n);

    validateConfig(
      CONFIG_KEYS.CMT_LANGUAGE,
      getI18nLocal(value),
      `${value} is not supported yet. Supported languages: ${supportedLanguages}`
    );

    return getI18nLocal(value);
  },

  [CONFIG_KEYS.CMT_API_URL](value: any) {
    validateConfig(
      CONFIG_KEYS.CMT_API_URL,
      typeof value === 'string',
      `${value} is not a valid URL. It should start with 'http://' or 'https://'.`
    );
    return value;
  },

  [CONFIG_KEYS.CMT_MODEL](value: any, config: any = {}) {
    validateConfig(
      CONFIG_KEYS.CMT_MODEL,
      typeof value === 'string',
      `${value} is not supported yet, use:\n\n ${[
        ...MODEL_LIST.openai,
        ...MODEL_LIST.anthropic,
        ...MODEL_LIST.gemini
      ].join('\n')}`
    );
    return value;
  },

  [CONFIG_KEYS.CMT_MESSAGE_TEMPLATE_PLACEHOLDER](value: any) {
    validateConfig(
      CONFIG_KEYS.CMT_MESSAGE_TEMPLATE_PLACEHOLDER,
      value.startsWith('$'),
      `${value} must start with $, for example: '$msg'`
    );
    return value;
  },

  [CONFIG_KEYS.CMT_PROMPT_MODULE](value: any) {
    validateConfig(
      CONFIG_KEYS.CMT_PROMPT_MODULE,
      ['conventional-commit', '@commitlint'].includes(value),
      `${value} is not supported yet, use '@commitlint' or 'conventional-commit' (default)`
    );
    return value;
  },

  [CONFIG_KEYS.CMT_DEBUG](value: any) {
    validateConfig(
      CONFIG_KEYS.CMT_DEBUG,
      typeof value === 'boolean',
      'Must be true or false'
    );
  },

  [CONFIG_KEYS.CMT_MAX_FILES](value: any) {
    value = parseInt(value);
    validateConfig(
      CONFIG_KEYS.CMT_MAX_FILES,
      !isNaN(value) && value > 0,
      'Must be a positive number'
    );
    return value;
  },

  [CONFIG_KEYS.CMT_MAX_DIFF_BYTES](value: any) {
    value = parseInt(value);
    validateConfig(
      CONFIG_KEYS.CMT_MAX_DIFF_BYTES,
      !isNaN(value) && value > 0,
      'Must be a positive number (size in bytes)'
    );
    return value;
  },

  [CONFIG_KEYS.CMT_LARGE_FILE_DIFF_BYTES](value: any) {
    value = parseInt(value);
    validateConfig(
      CONFIG_KEYS.CMT_LARGE_FILE_DIFF_BYTES,
      !isNaN(value) && value >= 0,
      'Must be a non-negative number in bytes (0 disables the large-file prompt)'
    );
    return value;
  },

  [CONFIG_KEYS.CMT_CHUNK_CONCURRENCY](value: any) {
    value = parseInt(value, 10);
    validateConfig(
      CONFIG_KEYS.CMT_CHUNK_CONCURRENCY,
      !isNaN(value) && value >= 1 && value <= 10,
      'Must be a number between 1 and 10'
    );
    return value;
  },

  [CONFIG_KEYS.CMT_SYNTHESIZE_CHUNKS](value: any) {
    validateConfig(
      CONFIG_KEYS.CMT_SYNTHESIZE_CHUNKS,
      typeof value === 'boolean',
      'Must be true or false'
    );
    return value;
  },

  // todo: deprecate
  [CONFIG_KEYS.CMT_GITPUSH](value: any) {
    validateConfig(
      CONFIG_KEYS.CMT_GITPUSH,
      typeof value === 'boolean',
      'Must be true or false'
    );
    return value;
  },

  [CONFIG_KEYS.CMT_AUTO_UPDATE](value: any) {
    validateConfig(
      CONFIG_KEYS.CMT_AUTO_UPDATE,
      typeof value === 'boolean',
      'Must be true or false'
    );
    return value;
  },

  [CONFIG_KEYS.CMT_LOCAL_MODEL_PRESET](value: any) {
    validateConfig(
      CONFIG_KEYS.CMT_LOCAL_MODEL_PRESET,
      ['qwen-0.5b', 'qwen-1.5b', 'gemma-2b'].includes(value),
      'Must be one of: qwen-0.5b, qwen-1.5b, gemma-2b'
    );
    return value;
  },

  [CONFIG_KEYS.CMT_LOCAL_RUNTIME](value: any) {
    validateConfig(
      CONFIG_KEYS.CMT_LOCAL_RUNTIME,
      ['auto', 'mlx', 'gguf'].includes(value),
      'Must be one of: auto, mlx, gguf'
    );
    return value;
  },

  [CONFIG_KEYS.CMT_LOCAL_CONTEXT_SIZE](value: any) {
    const numValue = Number(value);
    validateConfig(
      CONFIG_KEYS.CMT_LOCAL_CONTEXT_SIZE,
      !isNaN(numValue) && numValue >= 512 && numValue <= 32768,
      'Must be a number between 512 and 32768'
    );
    return numValue;
  },

  [CONFIG_KEYS.CMT_LOCAL_GPU_LAYERS](value: any) {
    const numValue = Number(value);
    validateConfig(
      CONFIG_KEYS.CMT_LOCAL_GPU_LAYERS,
      !isNaN(numValue) && numValue >= -1,
      'Must be -1 (auto) or a non-negative number'
    );
    return numValue;
  },

  [CONFIG_KEYS.CMT_LOCAL_DAEMON_PORT](value: any) {
    const numValue = Number(value);
    validateConfig(
      CONFIG_KEYS.CMT_LOCAL_DAEMON_PORT,
      !isNaN(numValue) && numValue > 0 && numValue <= 65535,
      'Must be a valid port number (1-65535)'
    );
    return numValue;
  },

  [CONFIG_KEYS.CMT_LOCAL_IDLE_TIMEOUT](value: any) {
    const numValue = Number(value);
    validateConfig(
      CONFIG_KEYS.CMT_LOCAL_IDLE_TIMEOUT,
      !isNaN(numValue) && numValue >= 0,
      'Must be a non-negative number of seconds'
    );
    return numValue;
  },

  [CONFIG_KEYS.CMT_LOCAL_PREFER_DAEMON](value: any) {
    validateConfig(
      CONFIG_KEYS.CMT_LOCAL_PREFER_DAEMON,
      typeof value === 'boolean',
      'Must be true or false'
    );
    return value;
  },

  [CONFIG_KEYS.CMT_LOCAL_CLOUD_FALLBACK](value: any) {
    validateConfig(
      CONFIG_KEYS.CMT_LOCAL_CLOUD_FALLBACK,
      typeof value === 'boolean',
      'Must be true or false'
    );
    return value;
  },

  [CONFIG_KEYS.CMT_LOCAL_FALLBACK_PROVIDER](value: any) {
    const validProviders = Object.values(CMT_AI_PROVIDER_ENUM).filter(
      (provider) => provider !== CMT_AI_PROVIDER_ENUM.LOCAL
    );
    validateConfig(
      CONFIG_KEYS.CMT_LOCAL_FALLBACK_PROVIDER,
      validProviders.includes(value as CMT_AI_PROVIDER_ENUM),
      `Must be a supported cloud provider: ${validProviders.join(', ')}`
    );
    return value;
  },

  [CONFIG_KEYS.CMT_LOCAL_FALLBACK_MODEL](value: any) {
    validateConfig(
      CONFIG_KEYS.CMT_LOCAL_FALLBACK_MODEL,
      typeof value === 'string' && value.length > 0,
      'Must be a non-empty string'
    );
    return value;
  },

  [CONFIG_KEYS.CMT_LOCAL_FALLBACK_API_KEY](value: any) {
    return value;
  },

  [CONFIG_KEYS.CMT_LOCAL_FALLBACK_API_URL](value: any) {
    return value;
  },

  [CONFIG_KEYS.CMT_AI_PROVIDER](value: any) {
    if (!value) value = 'openai';

    const validProviders = Object.values(CMT_AI_PROVIDER_ENUM);
    const isValid = validProviders.includes(value as CMT_AI_PROVIDER_ENUM) || value.startsWith('ollama');

    validateConfig(
      CONFIG_KEYS.CMT_AI_PROVIDER,
      isValid,
      `${value} is not supported. Valid providers: ${validProviders.join(', ')}`
    );

    return value;
  },

  [CONFIG_KEYS.CMT_ONE_LINE_COMMIT](value: any) {
    validateConfig(
      CONFIG_KEYS.CMT_ONE_LINE_COMMIT,
      typeof value === 'boolean',
      'Must be true or false'
    );

    return value;
  },

  [CONFIG_KEYS.CMT_TEST_MOCK_TYPE](value: any) {
    validateConfig(
      CONFIG_KEYS.CMT_TEST_MOCK_TYPE,
      TEST_MOCK_TYPES.includes(value),
      `${value} is not supported yet, use ${TEST_MOCK_TYPES.map(
        (t) => `'${t}'`
      ).join(', ')}`
    );
    return value;
  },

  [CONFIG_KEYS.CMT_WHY](value: any) {
    validateConfig(
      CONFIG_KEYS.CMT_WHY,
      typeof value === 'boolean',
      'Must be true or false'
    );
    return value;
  },

  [CONFIG_KEYS.CMT_SML](value: any) {
    validateConfig(
      CONFIG_KEYS.CMT_SML,
      typeof value === 'boolean',
      'Must be true or false'
    );
    return value;
  },

  [CONFIG_KEYS.CMT_REVIEW_MIN_SCORE](value: any) {
    if (value === undefined || value === null || value === '') return value;
    const numValue = Number(value);
    validateConfig(
      CONFIG_KEYS.CMT_REVIEW_MIN_SCORE,
      !isNaN(numValue) && numValue >= 0 && numValue <= 100,
      'Must be a number between 0 and 100'
    );
    return numValue;
  },

  [CONFIG_KEYS.CMT_REVIEW_CACHE_TTL](value: any) {
    if (value === undefined || value === null || value === '') return value;
    const numValue = Number(value);
    validateConfig(
      CONFIG_KEYS.CMT_REVIEW_CACHE_TTL,
      !isNaN(numValue) && numValue > 0 && numValue <= 168,
      'Must be a positive number (hours), maximum 168 (7 days)'
    );
    return numValue;
  },

  [CONFIG_KEYS.CMT_REVIEW_CACHE_DISABLED](value: any) {
    if (value === undefined || value === null || value === '') return value;
    validateConfig(
      CONFIG_KEYS.CMT_REVIEW_CACHE_DISABLED,
      value === true || value === false || value === 'true' || value === 'false',
      'Must be true or false'
    );
    return value;
  }
};

export enum CMT_AI_PROVIDER_ENUM {
  OLLAMA = 'ollama',
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  GEMINI = 'gemini',
  AZURE = 'azure',
  TEST = 'test',
  FLOWISE = 'flowise',
  GROQ = 'groq',
  MISTRAL = 'mistral',
  MLX = 'mlx',
  DEEPSEEK = 'deepseek',
  LOCAL = 'local'
}

export type ConfigType = {
  [CONFIG_KEYS.CMT_API_KEY]?: string;
  [CONFIG_KEYS.CMT_TOKENS_MAX_INPUT]?: number;
  [CONFIG_KEYS.CMT_TOKENS_MAX_OUTPUT]?: number;
  [CONFIG_KEYS.CMT_API_URL]?: string;
  [CONFIG_KEYS.CMT_DESCRIPTION]: boolean;
  [CONFIG_KEYS.CMT_EMOJI]: boolean;
  [CONFIG_KEYS.CMT_WHY]: boolean;
  [CONFIG_KEYS.CMT_MODEL]: string;
  [CONFIG_KEYS.CMT_LANGUAGE]: string;
  [CONFIG_KEYS.CMT_MESSAGE_TEMPLATE_PLACEHOLDER]: string;
  [CONFIG_KEYS.CMT_PROMPT_MODULE]: CMT_PROMPT_MODULE_ENUM;
  [CONFIG_KEYS.CMT_AI_PROVIDER]: CMT_AI_PROVIDER_ENUM;
  [CONFIG_KEYS.CMT_GITPUSH]: boolean;
  [CONFIG_KEYS.CMT_AUTO_UPDATE]: boolean;
  [CONFIG_KEYS.CMT_ONE_LINE_COMMIT]: boolean;
  [CONFIG_KEYS.CMT_DEBUG]: boolean;
  [CONFIG_KEYS.CMT_MAX_FILES]?: number;
  [CONFIG_KEYS.CMT_MAX_DIFF_BYTES]?: number;
  [CONFIG_KEYS.CMT_LARGE_FILE_DIFF_BYTES]?: number;
  [CONFIG_KEYS.CMT_CHUNK_CONCURRENCY]?: number;
  [CONFIG_KEYS.CMT_SYNTHESIZE_CHUNKS]?: boolean;
  [CONFIG_KEYS.CMT_SML]: boolean;
  [CONFIG_KEYS.CMT_REVIEW_MIN_SCORE]?: number;
  [CONFIG_KEYS.CMT_REVIEW_CACHE_TTL]?: number;
  [CONFIG_KEYS.CMT_REVIEW_CACHE_DISABLED]: boolean;
  [CONFIG_KEYS.CMT_TEST_MOCK_TYPE]: string;
  [CONFIG_KEYS.CMT_LOCAL_MODEL_PRESET]?: string;
  [CONFIG_KEYS.CMT_LOCAL_RUNTIME]?: string;
  [CONFIG_KEYS.CMT_LOCAL_CONTEXT_SIZE]?: number;
  [CONFIG_KEYS.CMT_LOCAL_GPU_LAYERS]?: number;
  [CONFIG_KEYS.CMT_LOCAL_DAEMON_PORT]?: number;
  [CONFIG_KEYS.CMT_LOCAL_IDLE_TIMEOUT]?: number;
  [CONFIG_KEYS.CMT_LOCAL_PREFER_DAEMON]?: boolean;
  [CONFIG_KEYS.CMT_LOCAL_CLOUD_FALLBACK]?: boolean;
  [CONFIG_KEYS.CMT_LOCAL_FALLBACK_PROVIDER]?: CMT_AI_PROVIDER_ENUM;
  [CONFIG_KEYS.CMT_LOCAL_FALLBACK_MODEL]?: string;
  [CONFIG_KEYS.CMT_LOCAL_FALLBACK_API_KEY]?: string;
  [CONFIG_KEYS.CMT_LOCAL_FALLBACK_API_URL]?: string;
};

export const defaultConfigPath = pathJoin(homedir(), '.commit-ai');
export const defaultEnvPath = pathResolve(process.cwd(), '.env');

const assertConfigsAreValid = (config: Record<string, any>) => {
  for (const [key, value] of Object.entries(config)) {
    if (!value) continue;

    if (typeof value === 'string' && ['null', 'undefined'].includes(value)) {
      config[key] = undefined;
      continue;
    }

    try {
      const validate = configValidators[key as CONFIG_KEYS];
      validate(value, config);
    } catch (error) {
      outro(`Unknown '${key}' config option or missing validator.`);
      outro(
        `Manually fix the '.env' file or global '~/.commit-ai' config file.`
      );

      process.exit(1);
    }
  }
};

enum CMT_PROMPT_MODULE_ENUM {
  CONVENTIONAL_COMMIT = 'conventional-commit',
  COMMITLINT = '@commitlint'
}

export const DEFAULT_CONFIG = {
  CMT_DESCRIPTION: false,
  CMT_EMOJI: false,
  CMT_MODEL: getDefaultModel('openai'),
  CMT_LANGUAGE: 'en',
  CMT_MESSAGE_TEMPLATE_PLACEHOLDER: '$msg',
  CMT_PROMPT_MODULE: CMT_PROMPT_MODULE_ENUM.CONVENTIONAL_COMMIT,
  CMT_AI_PROVIDER: CMT_AI_PROVIDER_ENUM.OPENAI,
  CMT_ONE_LINE_COMMIT: false,
  CMT_TEST_MOCK_TYPE: 'commit-message',
  CMT_WHY: false,
  CMT_SML: false,
  CMT_DEBUG: false,
  CMT_CHUNK_CONCURRENCY: 4,
  CMT_SYNTHESIZE_CHUNKS: true,
  CMT_GITPUSH: true, // todo: deprecate
  CMT_AUTO_UPDATE: false,
  CMT_LOCAL_MODEL_PRESET: 'qwen-0.5b',
  CMT_LOCAL_RUNTIME: 'auto',
  CMT_LOCAL_CONTEXT_SIZE: 4096,
  CMT_LOCAL_GPU_LAYERS: -1,
  CMT_LOCAL_DAEMON_PORT: 11435,
  CMT_LOCAL_IDLE_TIMEOUT: 1800,
  CMT_LOCAL_PREFER_DAEMON: true,
  CMT_LOCAL_CLOUD_FALLBACK: true,
  CMT_LOCAL_FALLBACK_PROVIDER: CMT_AI_PROVIDER_ENUM.OPENAI,
  CMT_LOCAL_FALLBACK_MODEL: 'gpt-4o-mini'
};

const initGlobalConfig = (configPath: string = defaultConfigPath) => {
  writeFileSync(configPath, iniStringify(DEFAULT_CONFIG), 'utf8');
  return DEFAULT_CONFIG;
};

const parseConfigVarValue = (value?: any) => {
  try {
    return JSON.parse(value);
  } catch (error) {
    return value;
  }
};

const getEnvConfig = (envPath: string) => {
  dotenv.config({ path: envPath });

  return {
    CMT_MODEL: process.env.CMT_MODEL,
    CMT_API_URL: process.env.CMT_API_URL,
    CMT_API_KEY: process.env.CMT_API_KEY,
    CMT_AI_PROVIDER: process.env.CMT_AI_PROVIDER as CMT_AI_PROVIDER_ENUM,

    CMT_TOKENS_MAX_INPUT: parseConfigVarValue(process.env.CMT_TOKENS_MAX_INPUT),
    CMT_TOKENS_MAX_OUTPUT: parseConfigVarValue(
      process.env.CMT_TOKENS_MAX_OUTPUT
    ),

    CMT_DESCRIPTION: parseConfigVarValue(process.env.CMT_DESCRIPTION),
    CMT_WHY: parseConfigVarValue(process.env.CMT_WHY),
    CMT_EMOJI: parseConfigVarValue(process.env.CMT_EMOJI),
    CMT_LANGUAGE: process.env.CMT_LANGUAGE,
    CMT_MESSAGE_TEMPLATE_PLACEHOLDER:
      process.env.CMT_MESSAGE_TEMPLATE_PLACEHOLDER,
    CMT_PROMPT_MODULE: process.env.CMT_PROMPT_MODULE as CMT_PROMPT_MODULE_ENUM,
    CMT_ONE_LINE_COMMIT: parseConfigVarValue(process.env.CMT_ONE_LINE_COMMIT),
    CMT_TEST_MOCK_TYPE: process.env.CMT_TEST_MOCK_TYPE,

    CMT_DEBUG: parseConfigVarValue(process.env.CMT_DEBUG),
    CMT_MAX_FILES: parseConfigVarValue(process.env.CMT_MAX_FILES),
    CMT_MAX_DIFF_BYTES: parseConfigVarValue(process.env.CMT_MAX_DIFF_BYTES),
    CMT_LARGE_FILE_DIFF_BYTES: parseConfigVarValue(
      process.env.CMT_LARGE_FILE_DIFF_BYTES
    ),
    CMT_CHUNK_CONCURRENCY: parseConfigVarValue(
      process.env.CMT_CHUNK_CONCURRENCY
    ),
    CMT_SYNTHESIZE_CHUNKS: parseConfigVarValue(
      process.env.CMT_SYNTHESIZE_CHUNKS
    ),
    CMT_SML: parseConfigVarValue(process.env.CMT_SML),
    CMT_REVIEW_MIN_SCORE: parseConfigVarValue(process.env.CMT_REVIEW_MIN_SCORE),
    CMT_REVIEW_CACHE_TTL: parseConfigVarValue(process.env.CMT_REVIEW_CACHE_TTL),
    CMT_REVIEW_CACHE_DISABLED: parseConfigVarValue(process.env.CMT_REVIEW_CACHE_DISABLED),
    CMT_GITPUSH: parseConfigVarValue(process.env.CMT_GITPUSH), // todo: deprecate
    CMT_AUTO_UPDATE: parseConfigVarValue(process.env.CMT_AUTO_UPDATE),
    CMT_LOCAL_MODEL_PRESET: process.env.CMT_LOCAL_MODEL_PRESET,
    CMT_LOCAL_RUNTIME: process.env.CMT_LOCAL_RUNTIME,
    CMT_LOCAL_CONTEXT_SIZE: parseConfigVarValue(
      process.env.CMT_LOCAL_CONTEXT_SIZE
    ),
    CMT_LOCAL_GPU_LAYERS: parseConfigVarValue(process.env.CMT_LOCAL_GPU_LAYERS),
    CMT_LOCAL_DAEMON_PORT: parseConfigVarValue(
      process.env.CMT_LOCAL_DAEMON_PORT
    ),
    CMT_LOCAL_IDLE_TIMEOUT: parseConfigVarValue(
      process.env.CMT_LOCAL_IDLE_TIMEOUT
    ),
    CMT_LOCAL_PREFER_DAEMON: parseConfigVarValue(
      process.env.CMT_LOCAL_PREFER_DAEMON
    ),
    CMT_LOCAL_CLOUD_FALLBACK: parseConfigVarValue(
      process.env.CMT_LOCAL_CLOUD_FALLBACK
    ),
    CMT_LOCAL_FALLBACK_PROVIDER: process.env
      .CMT_LOCAL_FALLBACK_PROVIDER as CMT_AI_PROVIDER_ENUM,
    CMT_LOCAL_FALLBACK_MODEL: process.env.CMT_LOCAL_FALLBACK_MODEL,
    CMT_LOCAL_FALLBACK_API_KEY: process.env.CMT_LOCAL_FALLBACK_API_KEY,
    CMT_LOCAL_FALLBACK_API_URL: process.env.CMT_LOCAL_FALLBACK_API_URL
  };
};

export const setGlobalConfig = (
  config: ConfigType,
  configPath: string = defaultConfigPath
) => {
  writeFileSync(configPath, iniStringify(config), 'utf8');
};

export const getIsGlobalConfigFileExist = (
  configPath: string = defaultConfigPath
) => {
  return existsSync(configPath);
};

export const getGlobalConfig = (configPath: string = defaultConfigPath) => {
  let globalConfig: ConfigType;

  const isGlobalConfigFileExist = getIsGlobalConfigFileExist(configPath);
  if (!isGlobalConfigFileExist) globalConfig = initGlobalConfig(configPath);
  else {
    const configFile = readFileSync(configPath, 'utf8');
    globalConfig = iniParse(configFile) as ConfigType;
  }

  return globalConfig;
};

/**
 * Merges two configs.
 * Env config takes precedence over global ~/.commit-ai config file
 * @param main - env config
 * @param fallback - global ~/.commit-ai config file
 * @returns merged config
 */
const mergeConfigs = (main: Partial<ConfigType>, fallback: ConfigType) => {
  const allKeys = new Set([...Object.keys(main), ...Object.keys(fallback)]);
  return Array.from(allKeys).reduce((acc, key) => {
    acc[key] = parseConfigVarValue(main[key] ?? fallback[key]);
    return acc;
  }, {} as ConfigType);
};

interface GetConfigOptions {
  globalPath?: string;
  envPath?: string;
  setDefaultValues?: boolean;
}

const cleanUndefinedValues = (config: ConfigType) => {
  return Object.fromEntries(
    Object.entries(config).map(([_, v]) => {
      try {
        if (typeof v === 'string') {
          if (v === 'undefined') return [_, undefined];
          if (v === 'null') return [_, null];

          const parsedValue = JSON.parse(v);
          return [_, parsedValue];
        }
        return [_, v];
      } catch (error) {
        return [_, v];
      }
    })
  );
};

export const getConfig = ({
  envPath = defaultEnvPath,
  globalPath = defaultConfigPath
}: GetConfigOptions = {}): ConfigType => {
  const envConfig = getEnvConfig(envPath);
  const globalConfig = getGlobalConfig(globalPath);

  const config = mergeConfigs(envConfig, globalConfig);

  const cleanConfig = cleanUndefinedValues(config);

  return cleanConfig as ConfigType;
};

export const setConfig = (
  keyValues: [key: string, value: string | boolean | number | null][],
  globalConfigPath: string = defaultConfigPath
) => {
  const config = getConfig({
    globalPath: globalConfigPath
  });

  const configToSet = {};

  for (let [key, value] of keyValues) {
    if (!configValidators.hasOwnProperty(key)) {
      const supportedKeys = Object.keys(configValidators).join('\n');
      throw new Error(
        `Unsupported config key: ${key}. Expected keys are:\n\n${supportedKeys}.\n\nFor more help refer to our docs: https://github.com/MantisWare/commit-ai`
      );
    }

    let parsedConfigValue;

    try {
      if (typeof value === 'string') parsedConfigValue = JSON.parse(value);
      else parsedConfigValue = value;
    } catch (error) {
      parsedConfigValue = value;
    }

    const validValue = configValidators[key as CONFIG_KEYS](
      parsedConfigValue,
      config
    );

    configToSet[key] = validValue;
  }

  setGlobalConfig(mergeConfigs(configToSet, config), globalConfigPath);

  outro(`${chalk.green('✔')} config successfully set`);
};

const CONFIG_HELP: Record<string, { description: string; example: string; default?: string }> = {
  CMT_API_KEY: {
    description: 'API key for the AI provider',
    example: 'sk-...',
    default: 'none (required)'
  },
  CMT_AI_PROVIDER: {
    description: 'AI provider to use',
    example: 'openai',
    default: 'openai'
  },
  CMT_MODEL: {
    description: 'AI model to use',
    example: 'gpt-4o-mini',
    default: 'gpt-4o-mini (openai)'
  },
  CMT_API_URL: {
    description: 'Custom API endpoint URL',
    example: 'http://localhost:11434/api/chat',
    default: 'provider default'
  },
  CMT_TOKENS_MAX_INPUT: {
    description: 'Maximum input tokens for AI requests',
    example: '40960',
    default: 'not set (provider/model specific)'
  },
  CMT_TOKENS_MAX_OUTPUT: {
    description: 'Maximum output tokens for AI responses',
    example: '4096',
    default: 'not set (provider/model specific)'
  },
  CMT_DESCRIPTION: {
    description: 'Add description to commit messages',
    example: 'true',
    default: 'false'
  },
  CMT_WHY: {
    description: 'Focus description on WHY (vs WHAT) changes were made',
    example: 'true',
    default: 'false'
  },
  CMT_EMOJI: {
    description: 'Enable GitMoji in commit messages',
    example: 'true',
    default: 'false'
  },
  CMT_LANGUAGE: {
    description: 'Language for commit messages',
    example: 'en',
    default: 'en'
  },
  CMT_ONE_LINE_COMMIT: {
    description: 'Generate single-line commit messages',
    example: 'true',
    default: 'false'
  },
  CMT_MESSAGE_TEMPLATE_PLACEHOLDER: {
    description: 'Template placeholder for commit messages',
    example: '$msg',
    default: '$msg'
  },
  CMT_PROMPT_MODULE: {
    description: 'Prompt module to use',
    example: 'conventional-commit',
    default: 'conventional-commit'
  },
  CMT_DEBUG: {
    description: 'Enable debug logging',
    example: 'true',
    default: 'false'
  },
  CMT_MAX_FILES: {
    description: 'Maximum files allowed in a commit',
    example: '50',
    default: 'unlimited'
  },
  CMT_MAX_DIFF_BYTES: {
    description: 'Maximum diff size in bytes',
    example: '102400',
    default: 'unlimited'
  },
  CMT_LARGE_FILE_DIFF_BYTES: {
    description:
      'Per-file diff size (bytes) above which you are asked whether to include the file in the commit (0 disables the prompt)',
    example: '1048576',
    default: '1048576 (1 MB)'
  },
  CMT_CHUNK_CONCURRENCY: {
    description:
      'Maximum parallel LLM requests when generating commit messages from large chunked diffs (1–10)',
    example: '4',
    default: '4'
  },
  CMT_SYNTHESIZE_CHUNKS: {
    description:
      'When true, merge multiple chunk commit messages into one cohesive message via a final LLM pass',
    example: 'true',
    default: 'true'
  },
  CMT_SML: {
    description: 'Generate condensed single-line messages per file with filename, line numbers, and brief description',
    example: 'true',
    default: 'false'
  },
  CMT_REVIEW_MIN_SCORE: {
    description: 'Minimum code quality score (0-100) required to proceed with commit when using --review flag',
    example: '70',
    default: 'not set (allows all scores)'
  },
  CMT_REVIEW_CACHE_TTL: {
    description: 'Time to live for cached review results in hours (max 168 hours / 7 days)',
    example: '24',
    default: '24 hours'
  },
  CMT_REVIEW_CACHE_DISABLED: {
    description: 'Disable review result caching (set to true to always perform fresh reviews)',
    example: 'false',
    default: 'false'
  },
  CMT_AUTO_UPDATE: {
    description:
      'Automatically install the latest CommitAI version when an update is available (checked on each cmt run)',
    example: 'true',
    default: 'false'
  },
  CMT_LOCAL_MODEL_PRESET: {
    description: 'Local SLM preset (qwen-0.5b, qwen-1.5b, gemma-2b)',
    example: 'qwen-0.5b',
    default: 'qwen-0.5b'
  },
  CMT_LOCAL_RUNTIME: {
    description: 'Local inference runtime (auto picks MLX on Apple Silicon, GGUF elsewhere)',
    example: 'auto',
    default: 'auto'
  },
  CMT_LOCAL_CONTEXT_SIZE: {
    description: 'Context window size for local models',
    example: '4096',
    default: '4096'
  },
  CMT_LOCAL_GPU_LAYERS: {
    description: 'GGUF GPU layer offload (-1 = all layers)',
    example: '-1',
    default: '-1'
  },
  CMT_LOCAL_DAEMON_PORT: {
    description: 'Port for cmt local serve daemon',
    example: '11435',
    default: '11435'
  },
  CMT_LOCAL_IDLE_TIMEOUT: {
    description: 'Daemon idle shutdown in seconds (0 = disabled)',
    example: '1800',
    default: '1800'
  },
  CMT_LOCAL_PREFER_DAEMON: {
    description: 'Prefer warm local daemon over on-demand model load',
    example: 'true',
    default: 'true'
  },
  CMT_LOCAL_CLOUD_FALLBACK: {
    description: 'Fall back to cloud provider when local inference fails',
    example: 'true',
    default: 'true'
  },
  CMT_LOCAL_FALLBACK_PROVIDER: {
    description: 'Cloud provider used when local fallback triggers',
    example: 'openai',
    default: 'openai'
  },
  CMT_LOCAL_FALLBACK_MODEL: {
    description: 'Cloud model used when local fallback triggers',
    example: 'gpt-4o-mini',
    default: 'gpt-4o-mini'
  },
  CMT_LOCAL_FALLBACK_API_KEY: {
    description: 'Optional separate API key for cloud fallback',
    example: 'sk-...',
    default: 'uses CMT_API_KEY'
  },
  CMT_LOCAL_FALLBACK_API_URL: {
    description: 'Optional separate API URL for cloud fallback',
    example: 'https://api.openai.com/v1',
    default: 'uses CMT_API_URL'
  }
};

const printConfigHelp = () => {
  console.log(chalk.bold.cyan('\nAvailable Configuration Options:\n'));

  Object.entries(CONFIG_HELP).forEach(([key, info]) => {
    console.log(chalk.bold(key));
    console.log(`  ${chalk.gray('Description:')} ${info.description}`);
    console.log(`  ${chalk.gray('Example:')}     ${chalk.yellow(info.example)}`);
    console.log(`  ${chalk.gray('Default:')}     ${info.default}`);
    console.log('');
  });

  console.log(chalk.bold.cyan('Usage Examples:\n'));
  console.log(`  ${chalk.gray('Get a config value:')}`);
  console.log(`    ${chalk.yellow('cmt config get CMT_MODEL')}\n`);
  console.log(`  ${chalk.gray('Set a config value:')}`);
  console.log(`    ${chalk.yellow('cmt config set CMT_MODEL=gpt-4o-mini')}\n`);
  console.log(`  ${chalk.gray('Set multiple values:')}`);
  console.log(`    ${chalk.yellow('cmt config set CMT_EMOJI=true CMT_DESCRIPTION=true')}\n`);
};

export const configCommand = command(
  {
    name: COMMANDS.config,
    parameters: ['<mode>', '[key=values...]'],
    help: {
      description: 'Manage global CommitAI configuration stored in ~/.commit-ai (get/set/help)'
    }
  },
  async (argv) => {
    try {
      const { mode, keyValues } = argv._;

      if (mode === 'help') {
        printConfigHelp();
        return;
      }

      if (!keyValues || keyValues.length === 0) {
        throw new Error(
          `Missing key=value pairs. Usage:\n  cmt config ${mode} KEY=VALUE\n  cmt config help`
        );
      }

      intro(`COMMAND: config ${mode} ${keyValues}`);

      if (mode === CONFIG_MODES.get) {
        const config = getConfig() || {};
        for (const key of keyValues) {
          outro(`${key}=${config[key as keyof typeof config]}`);
        }
      } else if (mode === CONFIG_MODES.set) {
        // Support both KEY=VALUE and KEY VALUE formats
        const parsedKeyValues: [string, string][] = [];

        for (let i = 0; i < keyValues.length; i++) {
          const keyValue = keyValues[i];

          if (keyValue.includes('=')) {
            // Format: KEY=VALUE
            const [key, ...valueParts] = keyValue.split('=');
            parsedKeyValues.push([key, valueParts.join('=')]);
          } else {
            // Format: KEY VALUE (space-separated)
            if (i + 1 < keyValues.length && !keyValues[i + 1].includes('=')) {
              parsedKeyValues.push([keyValue, keyValues[i + 1]]);
              i++; // Skip next value since we consumed it
            } else {
              throw new Error(
                `Invalid format for key "${keyValue}". Use either:\n` +
                `  cmt config set ${keyValue}=<value>\n` +
                `  cmt config set ${keyValue} <value>`
              );
            }
          }
        }

        await setConfig(parsedKeyValues);
      } else {
        throw new Error(
          `Unsupported mode: ${mode}. Valid modes are: "set", "get", and "help"`
        );
      }
    } catch (error) {
      outro(`${chalk.red('✖')} ${error}`);
      process.exit(1);
    }
  }
);
