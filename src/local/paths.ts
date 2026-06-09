import { existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { defaultConfigPath } from '../commands/config';

export const LOCAL_DAEMON_FILE = join(defaultConfigPath, 'local-daemon.json');
export const LOCAL_DAEMON_LOG = join(defaultConfigPath, 'local-daemon.log');
export const LOCAL_MODELS_DIR = join(defaultConfigPath, 'models');
export const LOCAL_GGUF_DIR = join(LOCAL_MODELS_DIR, 'gguf');
export const LOCAL_MLX_DIR = join(LOCAL_MODELS_DIR, 'mlx');
export const LOCAL_SETUP_MARKER = join(defaultConfigPath, 'local-setup.json');

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
