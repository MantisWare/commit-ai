import type { LocalRuntime } from './runtime';

export const LOCAL_MODEL_PRESET_IDS = [
  'qwen-0.5b',
  'qwen-1.5b',
  'gemma-2b'
] as const;

export type LocalModelPresetId = (typeof LOCAL_MODEL_PRESET_IDS)[number];

export interface GgufPresetSource {
  repo: string;
  file: string;
  diskMb: number;
  quantLabel: string;
}

export interface MlxPresetSource {
  repo: string;
  diskMb: number;
  quantLabel: string;
}

export interface LocalModelPreset {
  label: string;
  vramEstimateMb: number;
  gguf: GgufPresetSource;
  mlx: MlxPresetSource;
}

export const LOCAL_MODEL_PRESETS: Record<
  LocalModelPresetId,
  LocalModelPreset
> = {
  'qwen-0.5b': {
    label: 'Qwen2.5 0.5B Instruct',
    vramEstimateMb: 600,
    gguf: {
      repo: 'Qwen/Qwen2.5-0.5B-Instruct-GGUF',
      file: 'qwen2.5-0.5b-instruct-q4_k_m.gguf',
      diskMb: 491,
      quantLabel: 'GGUF Q4_K_M'
    },
    mlx: {
      repo: 'mlx-community/Qwen2.5-0.5B-Instruct-4bit',
      diskMb: 300,
      quantLabel: 'MLX 4-bit'
    }
  },
  'qwen-1.5b': {
    label: 'Qwen2.5 1.5B Instruct',
    vramEstimateMb: 1200,
    gguf: {
      repo: 'Qwen/Qwen2.5-1.5B-Instruct-GGUF',
      file: 'qwen2.5-1.5b-instruct-q4_k_m.gguf',
      diskMb: 1000,
      quantLabel: 'GGUF Q4_K_M'
    },
    mlx: {
      repo: 'mlx-community/Qwen2.5-1.5B-Instruct-4bit',
      diskMb: 869,
      quantLabel: 'MLX 4-bit'
    }
  },
  'gemma-2b': {
    label: 'Gemma 2 2B Instruct',
    vramEstimateMb: 1800,
    gguf: {
      repo: 'tensorblock/gemma-2-2b-it-GGUF',
      file: 'gemma-2-2b-it-Q4_K_M.gguf',
      diskMb: 1591,
      quantLabel: 'GGUF Q4_K_M'
    },
    mlx: {
      repo: 'mlx-community/gemma-2-2b-it-4bit',
      diskMb: 1470,
      quantLabel: 'MLX 4-bit'
    }
  }
};

export const DEFAULT_LOCAL_PRESET: LocalModelPresetId = 'qwen-0.5b';

export const isLocalModelPresetId = (
  value: string | undefined
): value is LocalModelPresetId => {
  if (value === undefined) return false;
  return (LOCAL_MODEL_PRESET_IDS as readonly string[]).includes(value);
};

export const resolvePreset = (
  presetId: string | undefined
): LocalModelPreset => {
  const id = isLocalModelPresetId(presetId) ? presetId : DEFAULT_LOCAL_PRESET;
  return LOCAL_MODEL_PRESETS[id];
};

export const getModelDisplayLabel = (
  preset: LocalModelPreset,
  runtime: LocalRuntime
): string => {
  const source = runtime === 'mlx' ? preset.mlx : preset.gguf;
  return `${preset.label} (${source.quantLabel})`;
};

export const getModelSourceForRuntime = (
  preset: LocalModelPreset,
  runtime: LocalRuntime
): GgufPresetSource | MlxPresetSource => {
  return runtime === 'mlx' ? preset.mlx : preset.gguf;
};
