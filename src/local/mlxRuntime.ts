import { existsSync } from 'fs';
import { execa } from 'execa';
import { OpenAI } from 'openai';
import type { LocalModelPreset } from './modelPresets';
import { getModelDisplayLabel } from './modelPresets';
import type { OnEngineStatus } from './types';
import {
  getLocalPython,
  getVenvPythonPath,
  LOCAL_VENV_DIR
} from './paths';
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
    await execa(getLocalPython(), ['-m', 'mlx_lm', '--help'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
};

/**
 * Installs mlx-lm into a dedicated virtual environment under the local data
 * dir. This sidesteps PEP 668 ("externally-managed-environment") on Homebrew
 * and system Python, and never touches the user's global site-packages.
 */
export const installMlxLm = async (): Promise<void> => {
  const venvPython = getVenvPythonPath();

  try {
    if (existsSync(venvPython) !== true) {
      await execa('python3', ['-m', 'venv', LOCAL_VENV_DIR], {
        stdio: 'inherit'
      });
    }

    await execa(venvPython, ['-m', 'pip', 'install', '--upgrade', 'pip'], {
      stdio: 'inherit'
    });
    await execa(venvPython, ['-m', 'pip', 'install', 'mlx-lm'], {
      stdio: 'inherit'
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : '';
    throw new Error(
      [
        `Failed to install mlx-lm into ${LOCAL_VENV_DIR}.`,
        'Try manually:',
        `  python3 -m venv "${LOCAL_VENV_DIR}"`,
        `  "${venvPython}" -m pip install mlx-lm`,
        detail
      ]
        .filter((line) => line !== '')
        .join('\n')
    );
  }
};

/**
 * Spawns the MLX server and returns the subprocess handle. This must NOT be an
 * async function that returns the execa result: because an execa subprocess is
 * a thenable, an `async` wrapper (or awaiting the caller) would suspend until
 * the process *exits* — and a long-running server never exits, hanging forever.
 * We return the live handle synchronously instead.
 */
const spawnEphemeralMlxServer = (
  modelRepo: string,
  port: number
): ReturnType<typeof execa> => {
  return execa(
    getLocalPython(),
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

  const serverProcess = spawnEphemeralMlxServer(modelRepo, ephemeralPort);
  // Prevent an unhandled rejection when we later SIGTERM the server (or if it
  // fails to spawn). A spawn failure surfaces as a health-check timeout below.
  serverProcess.catch(() => undefined);

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

/**
 * Spawns the long-running MLX daemon and returns the live subprocess handle.
 * Non-async on purpose (see spawnEphemeralMlxServer): awaiting an execa
 * subprocess would block until the never-exiting server process terminates.
 */
export const spawnMlxDaemon = (
  modelRepo: string,
  port: number,
  background = false
): ReturnType<typeof execa> => {
  return execa(
    getLocalPython(),
    ['-m', 'mlx_lm.server', '--model', modelRepo, '--port', String(port)],
    {
      stdio: background ? 'ignore' : 'inherit',
      detached: background
    }
  );
};
