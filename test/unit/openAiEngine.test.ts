import http from 'node:http';
import { AddressInfo } from 'node:net';
import { OpenAI } from 'openai';
import { DeepseekEngine } from '../../src/engine/deepseek';
import { OpenAiEngine } from '../../src/engine/openAi';

interface CapturedRequest {
  method: string;
  url: string;
  authorization: string | undefined;
  body: Record<string, unknown>;
}

/**
 * Guards the wire format against SDK upgrades: older models (gpt-3.5/gpt-4
 * era) and OpenAI-compatible providers (Groq, LM Studio, proxies) require
 * the legacy `max_tokens` param and `<baseURL>/chat/completions` routing.
 */
describe('OpenAiEngine request compatibility', () => {
  let server: http.Server;
  let baseURL: string;
  let captured: CapturedRequest | null = null;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      let raw = '';
      req.on('data', (chunk) => (raw += chunk));
      req.on('end', () => {
        captured = {
          method: req.method ?? '',
          url: req.url ?? '',
          authorization: req.headers.authorization,
          body: JSON.parse(raw)
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            id: 'chatcmpl-test',
            object: 'chat.completion',
            created: 0,
            model: 'gpt-3.5-turbo',
            choices: [
              {
                index: 0,
                message: { role: 'assistant', content: 'feat: test commit' },
                finish_reason: 'stop'
              }
            ]
          })
        );
      });
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });

    const { port } = server.address() as AddressInfo;
    baseURL = `http://127.0.0.1:${port}/v1`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  beforeEach(() => {
    captured = null;
  });

  const messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam> = [
    { role: 'system', content: 'You write commit messages.' },
    { role: 'user', content: 'diff --git a/file.ts b/file.ts' }
  ];

  it('sends legacy params older models rely on', async () => {
    const engine = new OpenAiEngine({
      apiKey: 'test-key',
      model: 'gpt-3.5-turbo',
      maxTokensOutput: 100,
      maxTokensInput: 4096,
      baseURL
    });

    const result = await engine.generateCommitMessage(messages);

    expect(result).toBe('feat: test commit');
    expect(captured).not.toBeNull();
    expect(captured?.method).toBe('POST');
    expect(captured?.url).toBe('/v1/chat/completions');
    expect(captured?.authorization).toBe('Bearer test-key');
    expect(captured?.body).toMatchObject({
      model: 'gpt-3.5-turbo',
      max_tokens: 100,
      temperature: 0,
      top_p: 0.1
    });
    expect(captured?.body.messages).toEqual(messages);
  });

  it('constructs with an empty apiKey for keyless endpoints', async () => {
    const engine = new OpenAiEngine({
      apiKey: '',
      model: 'local-model',
      maxTokensOutput: 100,
      maxTokensInput: 4096,
      baseURL
    });

    const result = await engine.generateCommitMessage(messages);
    expect(result).toBe('feat: test commit');
  });
});

describe('DeepseekEngine construction', () => {
  it('constructs without an apiKey for the placeholder client', () => {
    expect(
      () =>
        new DeepseekEngine({
          apiKey: '',
          model: 'deepseek-chat',
          maxTokensOutput: 100,
          maxTokensInput: 4096,
          baseURL: 'http://127.0.0.1:9'
        })
    ).not.toThrow();
  });
});
