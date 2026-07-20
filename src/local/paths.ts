import { existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

/** Data dir for models, daemon state, etc. (global config lives at ~/.commit-ai as a file). */
export const LOCAL_DATA_DIR = join(homedir(), '.commit-ai-local');

export const LOCAL_DAEMON_FILE = join(LOCAL_DATA_DIR, 'local-daemon.json');
export const LOCAL_DAEMON_LOG = join(LOCAL_DATA_DIR, 'local-daemon.log');
export const LOCAL_MODELS_DIR = join(LOCAL_DATA_DIR, 'models');
export const LOCAL_GGUF_DIR = join(LOCAL_MODELS_DIR, 'gguf');
export const LOCAL_MLX_DIR = join(LOCAL_MODELS_DIR, 'mlx');
export const LOCAL_SETUP_MARKER = join(LOCAL_DATA_DIR, 'local-setup.json');

/**
 * Dedicated virtual environment for mlx-lm. Using an isolated venv avoids the
 * PEP 668 "externally-managed-environment" error thrown by Homebrew/system
 * Python installs and keeps the user's global Python untouched.
 */
export const LOCAL_VENV_DIR = join(LOCAL_DATA_DIR, 'venv');

/** Absolute path to the managed venv's Python interpreter. */
export const getVenvPythonPath = (): string =>
  process.platform === 'win32'
    ? join(LOCAL_VENV_DIR, 'Scripts', 'python.exe')
    : join(LOCAL_VENV_DIR, 'bin', 'python3');

/**
 * Returns the managed venv Python when it exists, otherwise falls back to the
 * system `python3` (e.g. before setup has run).
 */
export const getLocalPython = (): string => {
  const venvPython = getVenvPythonPath();
  return existsSync(venvPython) === true ? venvPython : 'python3';
};

export const ensureLocalDirs = (): void => {
  for (const dir of [LOCAL_MODELS_DIR, LOCAL_GGUF_DIR, LOCAL_MLX_DIR]) {
    if (existsSync(dir) !== true) {
      mkdirSync(dir, { recursive: true });
    }
  }
};

export const getGgufModelPath = (fileName: string): string =>
  join(LOCAL_GGUF_DIR, fileName);

export const homedirPath = (): string => homedir();
