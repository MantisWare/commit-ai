import http from 'http';
import { OpenAI } from 'openai';
import type { LocalModelPreset } from './modelPresets';
import { downloadGgufModel, isGgufModelDownloaded } from './downloadModel';
import { getGgufModelPath } from './paths';

export interface GgufDaemonServerOptions {
  preset: LocalModelPreset;
  port: number;
  contextSize: number;
  gpuLayers: number;
  maxTokensOutput: number;
  idleTimeoutSeconds: number;
  onActivity?: () => void;
}

interface LoadedGgufModel {
  session: {
    prompt: (
      input: string,
      options?: { maxTokens?: number; temperature?: number; topP?: number }
    ) => Promise<string>;
    setChatHistory: (
      history: Array<{ type: 'system'; text: string }>
    ) => void;
  };
  dispose: () => Promise<void>;
}

let loadedModel: LoadedGgufModel | undefined;

const loadGgufModel = async (
  options: GgufDaemonServerOptions
): Promise<LoadedGgufModel> => {
  if (loadedModel !== undefined) {
    return loadedModel;
  }

  const modelPath = isGgufModelDownloaded(options.preset)
    ? getGgufModelPath(options.preset.gguf.file)
    : await downloadGgufModel(options.preset);

  const { importNodeLlamaCpp } = await import('./importNodeLlamaCpp');
  const { getLlama, LlamaChatSession } = await importNodeLlamaCpp();
  const llama = await getLlama();
  const model = await llama.loadModel({
    modelPath,
    gpuLayers: options.gpuLayers
  });
  const context = await model.createContext({
    contextSize: options.contextSize
  });
  const session = new LlamaChatSession({
    contextSequence: context.getSequence()
  });

  loadedModel = {
    session,
    dispose: async () => {
      await context.dispose();
      await model.dispose();
      loadedModel = undefined;
    }
  };

  return loadedModel;
};

const parseBody = (req: http.IncomingMessage): Promise<unknown> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw.length > 0 ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });

const generateFromMessages = async (
  messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>,
  maxTokensOutput: number,
  model: LoadedGgufModel
): Promise<string> => {
  const systemMessage = messages.find((m) => m.role === 'system');
  if (
    systemMessage !== undefined &&
    typeof systemMessage.content === 'string'
  ) {
    model.session.setChatHistory([
      { type: 'system', text: systemMessage.content }
    ]);
  }

  const conversationMessages = messages.filter((m) => m.role !== 'system');
  const lastUserIndex = conversationMessages
    .map((m) => m.role)
    .lastIndexOf('user');

  if (lastUserIndex === -1) {
    throw new Error('No user message found');
  }

  for (let index = 0; index < lastUserIndex; index += 1) {
    const message = conversationMessages[index];
    if (typeof message.content !== 'string') continue;
    if (message.role === 'user') {
      await model.session.prompt(message.content, { maxTokens: 1 });
    }
  }

  const lastUser = conversationMessages[lastUserIndex];
  const prompt =
    typeof lastUser.content === 'string' ? lastUser.content : '';

  return model.session.prompt(prompt, {
    maxTokens: maxTokensOutput,
    temperature: 0,
    topP: 0.1
  });
};

export const startGgufDaemonServer = async (
  options: GgufDaemonServerOptions
): Promise<http.Server> => {
  const model = await loadGgufModel(options);
  let idleTimer: ReturnType<typeof setTimeout> | undefined;

  const resetIdleTimer = (server: http.Server) => {
    if (options.idleTimeoutSeconds <= 0) return;
    if (idleTimer !== undefined) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      server.close();
      void model.dispose();
      process.exit(0);
    }, options.idleTimeoutSeconds * 1000);
  };

  const server = http.createServer(async (req, res) => {
    options.onActivity?.();
    resetIdleTimer(server);

    if (req.url === '/v1/models' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          data: [{ id: options.preset.gguf.file, object: 'model' }]
        })
      );
      return;
    }

    if (req.url === '/v1/chat/completions' && req.method === 'POST') {
      try {
        const body = (await parseBody(req)) as {
          messages?: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>;
        };
        const messages = body.messages ?? [];
        const content = await generateFromMessages(
          messages,
          options.maxTokensOutput,
          model
        );
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            choices: [{ message: { role: 'assistant', content } }]
          })
        );
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: {
              message:
                error instanceof Error ? error.message : 'Inference failed'
            }
          })
        );
      }
      return;
    }

    res.writeHead(404);
    res.end();
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(options.port, '127.0.0.1', () => resolve());
    server.on('error', reject);
  });

  resetIdleTimer(server);
  return server;
};
