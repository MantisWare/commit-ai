import type { ConfigType } from '../../src/commands/config';
import {
  hasCloudModelConfigured,
  resolveEngineOverrideFromFlags
} from '../../src/utils/engine';

describe('resolveEngineOverrideFromFlags', () => {
  it('returns "local" when only --local is set', () => {
    expect(resolveEngineOverrideFromFlags({ local: true })).toBe('local');
  });

  it('returns "cloud" when only --cloud is set', () => {
    expect(resolveEngineOverrideFromFlags({ cloud: true })).toBe('cloud');
  });

  it('returns undefined when neither flag is set', () => {
    expect(resolveEngineOverrideFromFlags({})).toBeUndefined();
    expect(
      resolveEngineOverrideFromFlags({ local: false, cloud: false })
    ).toBeUndefined();
  });

  it('throws when both flags are set', () => {
    expect(() =>
      resolveEngineOverrideFromFlags({ local: true, cloud: true })
    ).toThrow(/Cannot use --local and --cloud together/);
  });
});

describe('hasCloudModelConfigured', () => {
  it('is true when a main API key is set', () => {
    const config = { CMT_API_KEY: 'sk-123' } as ConfigType;
    expect(hasCloudModelConfigured(config)).toBe(true);
  });

  it('is true when a dedicated fallback API key is set', () => {
    const config = { CMT_LOCAL_FALLBACK_API_KEY: 'sk-fallback' } as ConfigType;
    expect(hasCloudModelConfigured(config)).toBe(true);
  });

  it('is false when no API key is configured', () => {
    const config = {} as ConfigType;
    expect(hasCloudModelConfigured(config)).toBe(false);
  });

  it('is false when the API key is an empty string', () => {
    const config = { CMT_API_KEY: '' } as ConfigType;
    expect(hasCloudModelConfigured(config)).toBe(false);
  });
});
