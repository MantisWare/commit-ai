import {
  detectGlobalPackageManager,
  getUpdateCommand,
  isVersionOlder,
  parseSemver
} from '../../src/utils/versionUpdate';

describe('versionUpdate', () => {
  describe('parseSemver', () => {
    it('parses standard semver strings', () => {
      expect(parseSemver('1.2.3')).toEqual([1, 2, 3]);
    });

    it('strips a leading v prefix', () => {
      expect(parseSemver('v2.0.0')).toEqual([2, 0, 0]);
    });

    it('defaults missing segments to zero', () => {
      expect(parseSemver('1')).toEqual([1, 0, 0]);
      expect(parseSemver('1.2')).toEqual([1, 2, 0]);
    });
  });

  describe('isVersionOlder', () => {
    it('returns true when patch is behind', () => {
      expect(isVersionOlder('1.0.13', '1.0.14')).toBe(true);
    });

    it('returns true when minor is behind', () => {
      expect(isVersionOlder('1.0.14', '1.1.0')).toBe(true);
    });

    it('returns true when major is behind', () => {
      expect(isVersionOlder('1.0.14', '2.0.0')).toBe(true);
    });

    it('returns false when versions match', () => {
      expect(isVersionOlder('1.0.14', '1.0.14')).toBe(false);
    });

    it('returns false when current is newer', () => {
      expect(isVersionOlder('1.0.15', '1.0.14')).toBe(false);
    });
  });

  describe('getUpdateCommand', () => {
    it('returns npm install command by default', () => {
      expect(getUpdateCommand('npm')).toBe(
        'npm i -g @mantisware/commit-ai@latest'
      );
    });

    it('returns pnpm install command', () => {
      expect(getUpdateCommand('pnpm')).toBe(
        'pnpm add -g @mantisware/commit-ai@latest'
      );
    });

    it('returns yarn install command', () => {
      expect(getUpdateCommand('yarn')).toBe(
        'yarn global add @mantisware/commit-ai@latest'
      );
    });
  });

  describe('detectGlobalPackageManager', () => {
    const originalArgv = process.argv;

    afterEach(() => {
      process.argv = originalArgv;
    });

    it('detects pnpm from script path', () => {
      process.argv = ['node', '/Users/me/.local/share/pnpm/global/5/node_modules/@mantisware/commit-ai/out/cli.cjs'];
      expect(detectGlobalPackageManager()).toBe('pnpm');
    });

    it('detects yarn from script path', () => {
      process.argv = ['node', '/Users/me/.config/yarn/global/node_modules/@mantisware/commit-ai/out/cli.cjs'];
      expect(detectGlobalPackageManager()).toBe('yarn');
    });

    it('defaults to npm', () => {
      process.argv = ['node', '/usr/local/lib/node_modules/@mantisware/commit-ai/out/cli.cjs'];
      expect(detectGlobalPackageManager()).toBe('npm');
    });
  });
});
