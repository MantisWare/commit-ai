import axios from 'axios';
import { OpenAI } from 'openai';
import { GenerateCommitMessageErrorEnum } from '../generateCommitMessageFromGitDiff';
import { tokenCount } from '../utils/tokenCount';
import { AiEngine, AiEngineConfig } from './Engine';

export interface OpenAiConfig extends AiEngineConfig {}

export class OpenAiEngine implements AiEngine {
  config: OpenAiConfig;
  client: OpenAI;

  constructor(config: OpenAiConfig) {
    this.config = config;

    const clientConfig = {
      // openai v5+ throws on a missing/empty apiKey at construction time;
      // v4 allowed it and let the server reject instead. Keyless setups
      // (local OpenAI-compatible endpoints, auth-injecting proxies) rely on
      // the old behavior, so substitute a placeholder the server can ignore.
      apiKey: config.apiKey !== '' ? config.apiKey : 'sk-no-key-configured',
      timeout: 120000, // 120 second timeout
      maxRetries: 5 // retried with exponential backoff on connection errors, 408/409/429 and 5xx
    };

    if (!config.baseURL) {
      this.client = new OpenAI(clientConfig);
    } else {
      this.client = new OpenAI({ ...clientConfig, baseURL: config.baseURL });
    }
  }

  public generateCommitMessage = async (
    messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>
  ): Promise<string | null> => {
    const params = {
      model: this.config.model,
      messages,
      temperature: 0,
      top_p: 0.1,
      max_tokens: this.config.maxTokensOutput
    };

    try {
      const REQUEST_TOKENS = messages
        .map((msg) => tokenCount(msg.content as string) + 4)
        .reduce((a, b) => a + b, 0);

      if (
        REQUEST_TOKENS >
        this.config.maxTokensInput - this.config.maxTokensOutput
      )
        throw new Error(GenerateCommitMessageErrorEnum.tooMuchTokens);

      const completion = await this.client.chat.completions.create(params);

      const message = completion.choices[0].message;

      return message?.content;
    } catch (error) {
      const err = error as Error;
      if (
        axios.isAxiosError<{ error?: { message: string } }>(error) &&
        error.response?.status === 401
      ) {
        const openAiError = error.response.data.error;

        if (openAiError) throw new Error(openAiError.message);
      }

      throw err;
    }
  };
}
