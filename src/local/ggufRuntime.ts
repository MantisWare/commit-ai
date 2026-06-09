import { OpenAI } from 'openai';
import type { LocalModelPreset } from './modelPresets';
import { getModelDisplayLabel } from './modelPresets';
import { downloadGgufModel, isGgufModelDownloaded } from './downloadModel';
import { getGgufModelPath } from './paths';
import type { OnEngineStatus } from './types';
import { postChatCompletions } from './chatCompletions';

export interface GgufGenerateOptions {
  preset: LocalModelPreset;
  contextSize: number;
  gpuLayers: number;
  maxTokensOutput: number;
  onStatus?: OnEngineStatus;
}

const loadNodeLlamaCpp = async () => {
  try {
    return await import('node-llama-cpp');
  } catch (error) {
    throw new Error(
      `node-llama-cpp is not installed. Run "cmt local setup" or use CMT_LOCAL_RUNTIME=mlx on Apple Silicon. Cause: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

export const generateWithGguf = async (
  messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>,
  options: GgufGenerateOptions
): Promise<string | undefined> => {
  const modelLabel = getModelDisplayLabel(options.preset, 'gguf');

  options.onStatus?.({
    phase: 'loading_model',
    modelLabel,
    runtime: 'gguf'
  });

  const modelPath = isGgufModelDownloaded(options.preset)
    ? getGgufModelPath(options.preset.gguf.file)
    : await downloadGgufModel(options.preset, options.onStatus);

  const { getLlama, LlamaChatSession } = await loadNodeLlamaCpp();
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

  const systemMessage = messages.find((m) => m.role === 'system');
  if (
    systemMessage !== undefined &&
    typeof systemMessage.content === 'string'
  ) {
    session.setChatHistory([
      { type: 'system', text: systemMessage.content }
    ]);
  }

  const conversationMessages = messages.filter((m) => m.role !== 'system');
  const lastUserIndex = conversationMessages
    .map((m) => m.role)
    .lastIndexOf('user');

  if (lastUserIndex === -1) {
    throw new Error('No user message found for local GGUF inference');
  }

  for (let index = 0; index < lastUserIndex; index += 1) {
    const message = conversationMessages[index];
    if (typeof message.content !== 'string') continue;
    if (message.role === 'user') {
      await session.prompt(message.content, { maxTokens: 1 });
    }
  }

  const lastUser = conversationMessages[lastUserIndex];
  const prompt =
    typeof lastUser.content === 'string' ? lastUser.content : '';

  const response = await session.prompt(prompt, {
    maxTokens: options.maxTokensOutput,
    temperature: 0,
    topP: 0.1
  });

  options.onStatus?.({ phase: 'ready', modelLabel, runtime: 'gguf' });

  await context.dispose();
  await model.dispose();

  return response.trim() || undefined;
};

export const generateWithGgufDaemon = async (
  messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>,
  options: {
    baseUrl: string;
    model: string;
    maxTokensOutput: number;
  }
): Promise<string | undefined> => {
  return postChatCompletions(messages, {
    baseUrl: options.baseUrl,
    model: options.model,
    maxTokensOutput: options.maxTokensOutput
  });
};
