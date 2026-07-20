import { detectShell, getRehashCommand } from '../../src/utils/refreshShell';

describe('refreshShell', () => {
  describe('detectShell', () => {
    it('detects zsh from a shell path', () => {
      expect(detectShell('/bin/zsh')).toBe('zsh');
    });

    it('detects bash from a shell path', () => {
      expect(detectShell('/usr/bin/bash')).toBe('bash');
    });

    it('detects fish from a shell path', () => {
      expect(detectShell('/opt/homebrew/bin/fish')).toBe('fish');
    });

    it('detects tcsh and csh', () => {
      expect(detectShell('/bin/tcsh')).toBe('tcsh');
      expect(detectShell('/bin/csh')).toBe('tcsh');
    });

    it('detects plain sh and dash', () => {
      expect(detectShell('/bin/sh')).toBe('sh');
      expect(detectShell('/bin/dash')).toBe('sh');
    });

    it('returns unknown for an empty path', () => {
      expect(detectShell('')).toBe('unknown');
    });

    it('returns unknown for unrecognized shells', () => {
      expect(detectShell('/usr/bin/nu')).toBe('unknown');
    });
  });

  describe('getRehashCommand', () => {
    it('returns rehash for zsh and tcsh', () => {
      expect(getRehashCommand('zsh')).toBe('rehash');
      expect(getRehashCommand('tcsh')).toBe('rehash');
    });

    it('returns hash -r for bash and sh', () => {
      expect(getRehashCommand('bash')).toBe('hash -r');
      expect(getRehashCommand('sh')).toBe('hash -r');
    });

    it('returns undefined for fish (auto-rehashes)', () => {
      expect(getRehashCommand('fish')).toBeUndefined();
    });

    it('falls back to hash -r for unknown shells', () => {
      expect(getRehashCommand('unknown')).toBe('hash -r');
    });
  });
});
