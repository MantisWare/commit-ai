import { OpenAI } from 'openai';
import type { OnEngineStatus } from '../local/types';
import { AiEngine } from './Engine';

export interface FallbackEngineOptions {
  onStatus?: OnEngineStatus;
  fallbackModelLabel: string;
}

export class FallbackEngine implements AiEngine {
  config: AiEngine['config'];
  client: AiEngine['client'];
  private primary: AiEngine;
  private fallback: AiEngine;
  private options: FallbackEngineOptions;

  constructor(
    primary: AiEngine,
    fallback: AiEngine,
    options: FallbackEngineOptions
  ) {
    this.primary = primary;
    this.fallback = fallback;
    this.config = primary.config;
    this.client = primary.client;
    this.options = options;
  }

  async generateCommitMessage(
    messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>
  ): Promise<string | undefined> {
    try {
      return await this.primary.generateCommitMessage(messages);
    } catch (error) {
      this.options.onStatus?.({
        phase: 'fallback_cloud',
        modelLabel: this.options.fallbackModelLabel,
        cause: error
      });

      return await this.fallback.generateCommitMessage(messages);
    }
  }
}
