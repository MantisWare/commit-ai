import { existsSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import {
  getCommitAIReviewIgnore,
  filterDiffForReview
} from '../../src/utils/git';

describe('git filtering for review', () => {
  const originalCwd = process.cwd();
  let testDir: string;

  beforeEach(() => {
    // Create a temporary test directory
    testDir = join(process.cwd(), `test-gitfilter-${Date.now()}`);
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

  describe('getCommitAIReviewIgnore', () => {
    it('should return empty ignore when file does not exist', () => {
      const ig = getCommitAIReviewIgnore();
      expect(ig).toBeDefined();
      expect(ig._rules).toHaveLength(0);
    });

    it('should load patterns from .commit-ai-review-ignore file', () => {
      const ignoreContent = `*.test.ts
*.spec.js
test/**
docs/**`;

      writeFileSync('.commit-ai-review-ignore', ignoreContent, 'utf-8');

      const ig = getCommitAIReviewIgnore();
      expect(ig._rules.length).toBeGreaterThan(0);
      expect(ig.ignores('file.test.ts')).toBe(true);
      expect(ig.ignores('file.spec.js')).toBe(true);
      expect(ig.ignores('test/file.ts')).toBe(true);
      expect(ig.ignores('docs/README.md')).toBe(true);
    });

    it('should handle comments and empty lines', () => {
      const ignoreContent = `# This is a comment
*.test.ts

# Another comment
*.spec.js
`;

      writeFileSync('.commit-ai-review-ignore', ignoreContent, 'utf-8');

      const ig = getCommitAIReviewIgnore();
      expect(ig.ignores('file.test.ts')).toBe(true);
      expect(ig.ignores('file.spec.js')).toBe(true);
    });

    it('should not ignore files not in patterns', () => {
      const ignoreContent = `*.test.ts
docs/**`;

      writeFileSync('.commit-ai-review-ignore', ignoreContent, 'utf-8');

      const ig = getCommitAIReviewIgnore();
      expect(ig.ignores('src/file.ts')).toBe(false);
      expect(ig.ignores('README.md')).toBe(false);
    });
  });

  describe('filterDiffForReview', () => {
    const sampleDiff = `diff --git a/src/main.ts b/src/main.ts
index 1234567..abcdefg 100644
--- a/src/main.ts
+++ b/src/main.ts
@@ -1,3 +1,4 @@
+console.log('test');
 function main() {
   return true;
 }
diff --git a/test/main.test.ts b/test/main.test.ts
index 2345678..bcdefgh 100644
--- a/test/main.test.ts
+++ b/test/main.test.ts
@@ -1,3 +1,4 @@
+// test
 describe('main', () => {
   it('works', () => {});
 });
diff --git a/README.md b/README.md
index 3456789..cdefghi 100644
--- a/README.md
+++ b/README.md
@@ -1,2 +1,3 @@
 # Project
+New documentation`;

    it('should return full diff when no ignore file exists', () => {
      const filtered = filterDiffForReview(sampleDiff);
      expect(filtered).toBe(sampleDiff);
      expect(filtered).toContain('src/main.ts');
      expect(filtered).toContain('test/main.test.ts');
      expect(filtered).toContain('README.md');
    });

    it('should filter out ignored files', () => {
      const ignoreContent = `*.test.ts
*.md`;

      writeFileSync('.commit-ai-review-ignore', ignoreContent, 'utf-8');

      const filtered = filterDiffForReview(sampleDiff);

      expect(filtered).toContain('src/main.ts');
      expect(filtered).not.toContain('test/main.test.ts');
      expect(filtered).not.toContain('README.md');
    });

    it('should filter out files in ignored directories', () => {
      const ignoreContent = `test/**
docs/**`;

      writeFileSync('.commit-ai-review-ignore', ignoreContent, 'utf-8');

      const filtered = filterDiffForReview(sampleDiff);

      expect(filtered).toContain('src/main.ts');
      expect(filtered).not.toContain('test/main.test.ts');
      expect(filtered).toContain('README.md');
    });

    it('should handle empty diff', () => {
      const filtered = filterDiffForReview('');
      expect(filtered).toBe('');
    });

    it('should handle diff with only ignored files', () => {
      const ignoreContent = `*.ts
*.md`;

      writeFileSync('.commit-ai-review-ignore', ignoreContent, 'utf-8');

      const filtered = filterDiffForReview(sampleDiff);

      expect(filtered).toBe('');
    });

    it('should preserve diff structure for non-ignored files', () => {
      const ignoreContent = `*.test.ts`;

      writeFileSync('.commit-ai-review-ignore', ignoreContent, 'utf-8');

      const filtered = filterDiffForReview(sampleDiff);

      // Should contain proper diff structure
      expect(filtered).toContain('diff --git a/src/main.ts');
      expect(filtered).toContain('index 1234567..abcdefg');
      expect(filtered).toContain('--- a/src/main.ts');
      expect(filtered).toContain('+++ b/src/main.ts');
      expect(filtered).toContain("console.log('test')");
    });

    it('should handle multiple files with mixed ignore patterns', () => {
      const complexDiff = `diff --git a/src/app.ts b/src/app.ts
index 111..222 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -1 +1,2 @@
+// app
 export const app = {};
diff --git a/src/app.test.ts b/src/app.test.ts
index 333..444 100644
--- a/src/app.test.ts
+++ b/src/app.test.ts
@@ -1 +1,2 @@
+// test
 test('app', () => {});
diff --git a/config.json b/config.json
index 555..666 100644
--- a/config.json
+++ b/config.json
@@ -1 +1,2 @@
+{"test": true}
 {}
diff --git a/docs/guide.md b/docs/guide.md
index 777..888 100644
--- a/docs/guide.md
+++ b/docs/guide.md
@@ -1 +1,2 @@
+# Guide
 Documentation`;

      const ignoreContent = `*.test.ts
docs/**
*.json`;

      writeFileSync('.commit-ai-review-ignore', ignoreContent, 'utf-8');

      const filtered = filterDiffForReview(complexDiff);

      expect(filtered).toContain('src/app.ts');
      expect(filtered).not.toContain('src/app.test.ts');
      expect(filtered).not.toContain('config.json');
      expect(filtered).not.toContain('docs/guide.md');
    });

    it('should handle whitespace in diff', () => {
      const diffWithWhitespace = `

diff --git a/file1.ts b/file1.ts
index 111..222 100644
--- a/file1.ts
+++ b/file1.ts
@@ -1 +1,2 @@
+line
 content

diff --git a/file2.test.ts b/file2.test.ts
index 333..444 100644
--- a/file2.test.ts
+++ b/file2.test.ts
@@ -1 +1,2 @@
+test
 content
`;

      const ignoreContent = `*.test.ts`;
      writeFileSync('.commit-ai-review-ignore', ignoreContent, 'utf-8');

      const filtered = filterDiffForReview(diffWithWhitespace);

      expect(filtered).toContain('file1.ts');
      expect(filtered).not.toContain('file2.test.ts');
    });
  });
});
