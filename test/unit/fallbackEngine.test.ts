import { OpenAI } from 'openai';
import { FallbackEngine } from '../../src/engine/fallback';
import { AiEngine } from '../../src/engine/Engine';

class StubEngine implements AiEngine {
  config = {
    apiKey: 'test',
    model: 'stub',
    maxTokensOutput: 128,
    maxTokensInput: 4096
  };

  client = {} as AiEngine['client'];

  constructor(
    private readonly handler: (
      messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>
    ) => Promise<string | undefined>
  ) {}

  generateCommitMessage(
    messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>
  ): Promise<string | undefined> {
    return this.handler(messages);
  }
}

describe('FallbackEngine', () => {
  it('returns primary result when local succeeds', async () => {
    const primary = new StubEngine(async () => 'local commit');
    const fallback = new StubEngine(async () => 'cloud commit');
    const engine = new FallbackEngine(primary, fallback, {
      fallbackModelLabel: 'gpt-4o-mini'
    });

    await expect(
      engine.generateCommitMessage([{ role: 'user', content: 'diff' }])
    ).resolves.toBe('local commit');
  });

  it('falls back to cloud when primary fails', async () => {
    const statuses: string[] = [];
    const primary = new StubEngine(async () => {
      throw new Error('local failed');
    });
    const fallback = new StubEngine(async () => 'cloud commit');
    const engine = new FallbackEngine(primary, fallback, {
      fallbackModelLabel: 'gpt-4o-mini',
      onStatus: (status) => {
        statuses.push(status.phase);
      }
    });

    await expect(
      engine.generateCommitMessage([{ role: 'user', content: 'diff' }])
    ).resolves.toBe('cloud commit');
    expect(statuses).toContain('fallback_cloud');
  });
});
