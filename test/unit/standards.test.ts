import { existsSync, rmSync, writeFileSync, readFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import {
  getStandardsFilePath,
  standardsFileExists,
  getStandards,
  writeStandards
} from '../../src/commands/standards';

describe('standards', () => {
  const originalCwd = process.cwd();
  let testDir: string;

  beforeEach(() => {
    // Create a temporary test directory
    testDir = join(process.cwd(), `test-standards-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);
  });

  afterEach(() => {
    // Clean up
    process.chdir(originalCwd);
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('getStandardsFilePath', () => {
    it('should return path to .commit-ai-standards in current directory', () => {
      const path = getStandardsFilePath();
      expect(path).toContain('.commit-ai-standards');
      expect(path).toBe(join(process.cwd(), '.commit-ai-standards'));
    });
  });

  describe('standardsFileExists', () => {
    it('should return false when standards file does not exist', () => {
      expect(standardsFileExists()).toBe(false);
    });

    it('should return true when standards file exists', () => {
      const standardsPath = getStandardsFilePath();
      writeFileSync(standardsPath, '# Test Standards', 'utf-8');

      expect(standardsFileExists()).toBe(true);
    });
  });

  describe('getStandards', () => {
    it('should return null when standards file does not exist', () => {
      const standards = getStandards();
      expect(standards).toBeNull();
    });

    it('should return standards content when file exists', () => {
      const testContent = '# Test Standards\n- Rule 1\n- Rule 2';
      const standardsPath = getStandardsFilePath();
      writeFileSync(standardsPath, testContent, 'utf-8');

      const standards = getStandards();
      expect(standards).toBe(testContent);
    });

    it('should handle empty standards file', () => {
      const standardsPath = getStandardsFilePath();
      writeFileSync(standardsPath, '', 'utf-8');

      const standards = getStandards();
      expect(standards).toBe('');
    });

    it('should handle multiline standards with special characters', () => {
      const testContent = `# Code Standards
## Security
- Never use \`eval()\`
- Validate inputs with regex: /^[a-z]+$/

## Performance
- Use \`const\` for immutable values
- Cache expensive operations`;

      const standardsPath = getStandardsFilePath();
      writeFileSync(standardsPath, testContent, 'utf-8');

      const standards = getStandards();
      expect(standards).toBe(testContent);
      expect(standards).toContain('eval()');
      expect(standards).toContain('/^[a-z]+$/');
    });
  });

  describe('writeStandards', () => {
    it('should create standards file with content', () => {
      const testContent = '# My Standards\n- Rule 1';
      writeStandards(testContent);

      const standardsPath = getStandardsFilePath();
      expect(existsSync(standardsPath)).toBe(true);

      const fileContent = readFileSync(standardsPath, 'utf-8');
      expect(fileContent).toBe(testContent);
    });

    it('should overwrite existing standards file', () => {
      const initialContent = '# Initial Standards';
      const updatedContent = '# Updated Standards';

      writeStandards(initialContent);
      writeStandards(updatedContent);

      const standards = getStandards();
      expect(standards).toBe(updatedContent);
      expect(standards).not.toContain('Initial');
    });

    it('should handle empty content', () => {
      writeStandards('');

      const standardsPath = getStandardsFilePath();
      expect(existsSync(standardsPath)).toBe(true);
      expect(getStandards()).toBe('');
    });

    it('should handle large standards content', () => {
      const largeContent = '# Standards\n' + '- Rule\n'.repeat(1000);
      writeStandards(largeContent);

      const standards = getStandards();
      expect(standards).toBe(largeContent);
      expect(standards?.split('\n').length).toBeGreaterThanOrEqual(1001);
    });

    it('should preserve formatting and indentation', () => {
      const formattedContent = `# Standards

## Section 1
  - Indented rule
    - Nested rule

## Section 2
- Another rule`;

      writeStandards(formattedContent);

      const standards = getStandards();
      expect(standards).toBe(formattedContent);
      expect(standards).toContain('  - Indented');
      expect(standards).toContain('    - Nested');
    });
  });

  describe('standards integration', () => {
    it('should support full workflow: write, read, check existence', () => {
      // Initially no standards
      expect(standardsFileExists()).toBe(false);
      expect(getStandards()).toBeNull();

      // Write standards
      const content = '# Test Standards';
      writeStandards(content);

      // Verify existence
      expect(standardsFileExists()).toBe(true);

      // Read standards
      const standards = getStandards();
      expect(standards).toBe(content);

      // Update standards
      const updatedContent = '# Updated Test Standards';
      writeStandards(updatedContent);

      // Verify update
      expect(getStandards()).toBe(updatedContent);
    });
  });
});
