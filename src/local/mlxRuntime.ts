import { execa } from 'execa';
import { OpenAI } from 'openai';
import type { LocalModelPreset } from './modelPresets';
import { getModelDisplayLabel } from './modelPresets';
import type { OnEngineStatus } from './types';
import {
  postChatCompletions,
  waitForServerHealth
} from './chatCompletions';

export interface MlxGenerateOptions {
  preset: LocalModelPreset;
  maxTokensOutput: number;
  onStatus?: OnEngineStatus;
}

export const checkMlxLmInstalled = async (): Promise<boolean> => {
  try {
    await execa('python3', ['-m', 'mlx_lm', '--help'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
};

export const installMlxLm = async (): Promise<void> => {
  const installArgs = ['-m', 'pip', 'install', '--user', 'mlx-lm'];
  try {
    await execa('python3', installArgs, { stdio: 'inherit' });
  } catch (error) {
    throw new Error(
      `Failed to install mlx-lm. Try manually: python3 -m pip install --user mlx-lm. ${error instanceof Error ? error.message : ''}`
    );
  }
};

const spawnEphemeralMlxServer = async (
  modelRepo: string,
  port: number
): Promise<ReturnType<typeof execa>> => {
  return execa(
    'python3',
    ['-m', 'mlx_lm.server', '--model', modelRepo, '--port', String(port)],
    {
      stdio: 'pipe',
      detached: false
    }
  );
};

export const generateWithMlx = async (
  messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>,
  options: MlxGenerateOptions
): Promise<string | undefined> => {
  const modelLabel = getModelDisplayLabel(options.preset, 'mlx');
  const modelRepo = options.preset.mlx.repo;

  const mlxInstalled = await checkMlxLmInstalled();
  if (mlxInstalled !== true) {
    throw new Error(
      'mlx-lm is not installed. Run "cmt local setup" to install Python dependencies.'
    );
  }

  options.onStatus?.({
    phase: 'loading_model',
    modelLabel,
    runtime: 'mlx'
  });

  const ephemeralPort = 11_436 + Math.floor(Math.random() * 1000);
  const baseUrl = `http://127.0.0.1:${ephemeralPort}`;

  options.onStatus?.({
    phase: 'starting_daemon',
    modelLabel,
    runtime: 'mlx',
    port: ephemeralPort
  });

  const serverProcess = await spawnEphemeralMlxServer(modelRepo, ephemeralPort);

  try {
    await waitForServerHealth(baseUrl, { timeoutMs: 120_000 });

    const result = await postChatCompletions(messages, {
      baseUrl,
      model: modelRepo,
      maxTokensOutput: options.maxTokensOutput,
      repetitionPenalty: 1.5
    });

    options.onStatus?.({ phase: 'ready', modelLabel, runtime: 'mlx' });
    return result;
  } finally {
    serverProcess.kill('SIGTERM');
  }
};

export const generateWithMlxDaemon = async (
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
    maxTokensOutput: options.maxTokensOutput,
    repetitionPenalty: 1.5
  });
};

export const spawnMlxDaemon = async (
  modelRepo: string,
  port: number,
  background = false
): Promise<ReturnType<typeof execa>> => {
  return execa(
    'python3',
    ['-m', 'mlx_lm.server', '--model', modelRepo, '--port', String(port)],
    {
      stdio: background ? 'ignore' : 'inherit',
      detached: background
    }
  );
};
