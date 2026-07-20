import axios from 'axios';
import { OpenAI } from 'openai';
import { sanitizeLocalOutput } from './sanitizeOutput';

export interface ChatCompletionOptions {
  baseUrl: string;
  model: string;
  maxTokensOutput?: number;
  timeoutMs?: number;
  repetitionPenalty?: number;
}

export const postChatCompletions = async (
  messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>,
  options: ChatCompletionOptions
): Promise<string | undefined> => {
  const url = `${options.baseUrl.replace(/\/$/, '')}/v1/chat/completions`;
  const params: Record<string, unknown> = {
    model: options.model,
    messages,
    temperature: 0,
    top_p: 0.1,
    stream: false
  };

  if (options.maxTokensOutput !== undefined) {
    params.max_tokens = options.maxTokensOutput;
  }

  if (options.repetitionPenalty !== undefined) {
    params.repetition_penalty = options.repetitionPenalty;
  }

  const response = await axios.post(url, params, {
    headers: { 'Content-Type': 'application/json' },
    timeout: options.timeoutMs ?? 120_000
  });

  const content = response.data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') return undefined;
  return sanitizeLocalOutput(content);
};

export const checkServerHealth = async (
  baseUrl: string,
  timeoutMs = 2_000
): Promise<boolean> => {
  try {
    const url = `${baseUrl.replace(/\/$/, '')}/v1/models`;
    await axios.get(url, { timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
};

export const waitForServerHealth = async (
  baseUrl: string,
  options: { timeoutMs?: number; pollIntervalMs?: number } = {}
): Promise<void> => {
  const timeoutMs = options.timeoutMs ?? 120_000;
  const pollIntervalMs = options.pollIntervalMs ?? 500;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const healthy = await checkServerHealth(baseUrl, pollIntervalMs);
    if (healthy === true) return;
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`Local model server did not become ready at ${baseUrl}`);
};
