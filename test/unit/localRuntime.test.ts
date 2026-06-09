import { detectRuntime } from '../../src/local/runtime';
import {
  DEFAULT_LOCAL_PRESET,
  getModelDisplayLabel,
  isLocalModelPresetId,
  resolvePreset
} from '../../src/local/modelPresets';
import { formatEngineStatusLabel } from '../../src/local/statusLabels';

describe('local runtime', () => {
  const originalPlatform = process.platform;
  const originalArch = process.arch;

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    Object.defineProperty(process, 'arch', { value: originalArch });
  });

  it('detects mlx on darwin arm64 with auto runtime', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    Object.defineProperty(process, 'arch', { value: 'arm64' });
    expect(detectRuntime('auto')).toBe('mlx');
  });

  it('detects gguf on linux with auto runtime', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    Object.defineProperty(process, 'arch', { value: 'x64' });
    expect(detectRuntime('auto')).toBe('gguf');
  });

  it('respects explicit runtime override', () => {
    expect(detectRuntime('gguf')).toBe('gguf');
    expect(detectRuntime('mlx')).toBe('mlx');
  });
});

describe('local model presets', () => {
  it('resolves default preset for unknown ids', () => {
    expect(resolvePreset(undefined).label).toContain('0.5B');
    expect(isLocalModelPresetId('invalid')).toBe(false);
    expect(isLocalModelPresetId(DEFAULT_LOCAL_PRESET)).toBe(true);
  });

  it('formats display labels per runtime', () => {
    const preset = resolvePreset('qwen-0.5b');
    expect(getModelDisplayLabel(preset, 'mlx')).toContain('MLX');
    expect(getModelDisplayLabel(preset, 'gguf')).toContain('GGUF');
  });
});

describe('engine status labels', () => {
  it('formats warmup and fallback labels', () => {
    expect(
      formatEngineStatusLabel({
        phase: 'loading_model',
        modelLabel: 'Qwen2.5 0.5B Instruct (MLX 4-bit)'
      })
    ).toContain('Warming up');
    expect(
      formatEngineStatusLabel({
        phase: 'fallback_cloud',
        modelLabel: 'gpt-4o-mini',
        cause: new Error('mlx-lm not found')
      })
    ).toContain('Falling back');
  });
});
