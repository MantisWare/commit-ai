import axios from 'axios';
import { OpenAI } from 'openai';
import { GenerateCommitMessageErrorEnum } from '../generateCommitMessageFromGitDiff';
import { tokenCount } from '../utils/tokenCount';
import { AiEngine, AiEngineConfig } from './Engine';

export interface DeepseekConfig extends AiEngineConfig {
  baseURL: string; // LM Studio's API endpoint
}

export class DeepseekEngine implements AiEngine {
  config: DeepseekConfig;
  client: OpenAI;

  constructor(config: DeepseekConfig) {
    this.config = config;
    this.client = new OpenAI({ apiKey: '' }); // Placeholder client to satisfy interface
  }

  public generateCommitMessage = async (
    messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>
  ): Promise<string | null> => {
    const params = {
      model: this.config.model,
      messages,
      temperature: 0.7,
      max_tokens: this.config.maxTokensOutput,
      stream: false,
    };

    try {
      const REQUEST_TOKENS = messages
        .map((msg) => tokenCount(msg.content as string) + 4)
        .reduce((a, b) => a + b, 0);

      if (
        REQUEST_TOKENS >
        this.config.maxTokensInput - this.config.maxTokensOutput
      ) {
        throw new Error(GenerateCommitMessageErrorEnum.tooMuchTokens);
      }

      const response = await axios.post(`${this.config.baseURL}/v1/chat/completions`, params, {
        headers: { 'Content-Type': 'application/json' },
      });

      const message = response.data.choices?.[0]?.message;

      return message?.content || null;
    } catch (error) {
      const err = error as Error;
      if (
        axios.isAxiosError<{ error?: { message: string } }>(error) &&
        error.response?.status === 401
      ) {
        const apiError = error.response.data.error;
        if (apiError) throw new Error(apiError.message);
      }

      throw err;
    }
  };
}
