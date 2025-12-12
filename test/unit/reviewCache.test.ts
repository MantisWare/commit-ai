import { existsSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import {
  getCachedReview,
  cacheReview,
  clearReviewCache,
  getCacheStats
} from '../../src/utils/reviewCache';
import { ReviewResult } from '../../src/commands/review';

describe('reviewCache', () => {
  const CACHE_DIR = join(homedir(), '.commit-ai-cache');
  const CACHE_FILE = join(CACHE_DIR, 'review-cache.json');

  const mockReviewResult: ReviewResult = {
    summary: 'Test review',
    overallScore: 85,
    recommendation: 'approve',
    findings: []
  };

  const testDiff = `diff --git a/test.ts b/test.ts
index 1234567..abcdefg 100644
--- a/test.ts
+++ b/test.ts
@@ -1,3 +1,4 @@
+console.log('test');
 function test() {
   return true;
 }`;

  beforeEach(() => {
    // Clean up cache before each test
    if (existsSync(CACHE_DIR)) {
      rmSync(CACHE_DIR, { recursive: true, force: true });
    }
    delete process.env.CMT_REVIEW_CACHE_DISABLED;
    delete process.env.CMT_REVIEW_CACHE_TTL;
  });

  afterEach(() => {
    // Clean up after tests
    if (existsSync(CACHE_DIR)) {
      rmSync(CACHE_DIR, { recursive: true, force: true });
    }
    delete process.env.CMT_REVIEW_CACHE_DISABLED;
    delete process.env.CMT_REVIEW_CACHE_TTL;
  });

  describe('cacheReview', () => {
    it('should cache a review result', () => {
      cacheReview(testDiff, null, mockReviewResult);

      expect(existsSync(CACHE_FILE)).toBe(true);
    });

    it('should cache review with standards', () => {
      const standards = '# Test Standards\n- Rule 1\n- Rule 2';
      cacheReview(testDiff, standards, mockReviewResult);

      const cached = getCachedReview(testDiff, standards);
      expect(cached).not.toBeNull();
      expect(cached?.overallScore).toBe(85);
    });

    it('should not cache when disabled', () => {
      process.env.CMT_REVIEW_CACHE_DISABLED = 'true';

      cacheReview(testDiff, null, mockReviewResult);
      const cached = getCachedReview(testDiff, null);

      expect(cached).toBeNull();
    });

    it('should create cache directory if it does not exist', () => {
      expect(existsSync(CACHE_DIR)).toBe(false);

      cacheReview(testDiff, null, mockReviewResult);

      expect(existsSync(CACHE_DIR)).toBe(true);
      expect(existsSync(CACHE_FILE)).toBe(true);
    });
  });

  describe('getCachedReview', () => {
    it('should return cached review for same diff', () => {
      cacheReview(testDiff, null, mockReviewResult);

      const cached = getCachedReview(testDiff, null);

      expect(cached).not.toBeNull();
      expect(cached?.summary).toBe('Test review');
      expect(cached?.overallScore).toBe(85);
      expect(cached?.recommendation).toBe('approve');
    });

    it('should return null for different diff', () => {
      cacheReview(testDiff, null, mockReviewResult);

      const differentDiff = testDiff + '\n+// more changes';
      const cached = getCachedReview(differentDiff, null);

      expect(cached).toBeNull();
    });

    it('should return null when cache is disabled', () => {
      cacheReview(testDiff, null, mockReviewResult);

      process.env.CMT_REVIEW_CACHE_DISABLED = 'true';
      const cached = getCachedReview(testDiff, null);

      expect(cached).toBeNull();
    });

    it('should differentiate between different standards', () => {
      const standards1 = '# Standards 1';
      const standards2 = '# Standards 2';

      const result1 = { ...mockReviewResult, overallScore: 80 };
      const result2 = { ...mockReviewResult, overallScore: 90 };

      cacheReview(testDiff, standards1, result1);
      cacheReview(testDiff, standards2, result2);

      const cached1 = getCachedReview(testDiff, standards1);
      const cached2 = getCachedReview(testDiff, standards2);

      expect(cached1?.overallScore).toBe(80);
      expect(cached2?.overallScore).toBe(90);
    });

    it('should return null for expired cache', (done) => {
      // Set TTL to 0.001 hours (3.6 seconds)
      process.env.CMT_REVIEW_CACHE_TTL = '0.001';

      cacheReview(testDiff, null, mockReviewResult);

      // Wait for cache to expire (4 seconds)
      setTimeout(() => {
        const cached = getCachedReview(testDiff, null);
        expect(cached).toBeNull();
        done();
      }, 4000);
    }, 10000);

    it('should return null when no cache exists', () => {
      const cached = getCachedReview(testDiff, null);
      expect(cached).toBeNull();
    });
  });

  describe('clearReviewCache', () => {
    it('should clear all cached reviews', () => {
      cacheReview(testDiff, null, mockReviewResult);
      cacheReview(testDiff + '\n// change', null, mockReviewResult);

      let stats = getCacheStats();
      expect(stats.totalEntries).toBeGreaterThan(0);

      clearReviewCache();

      stats = getCacheStats();
      expect(stats.totalEntries).toBe(0);
    });

    it('should create empty cache file', () => {
      clearReviewCache();

      expect(existsSync(CACHE_FILE)).toBe(true);
      const cached = getCachedReview(testDiff, null);
      expect(cached).toBeNull();
    });
  });

  describe('getCacheStats', () => {
    it('should return zero stats for empty cache', () => {
      const stats = getCacheStats();

      expect(stats.totalEntries).toBe(0);
      expect(stats.validEntries).toBe(0);
    });

    it('should return correct stats for cached reviews', () => {
      cacheReview(testDiff, null, mockReviewResult);
      cacheReview(testDiff + '\n// change 1', null, mockReviewResult);
      cacheReview(testDiff + '\n// change 2', null, mockReviewResult);

      const stats = getCacheStats();

      expect(stats.totalEntries).toBe(3);
      expect(stats.validEntries).toBe(3);
      expect(stats.cacheSize).toContain('KB');
    });

    it('should distinguish between total and valid entries for expired cache', (done) => {
      // Set TTL to 0.001 hours
      process.env.CMT_REVIEW_CACHE_TTL = '0.001';

      cacheReview(testDiff, null, mockReviewResult);

      setTimeout(() => {
        const stats = getCacheStats();
        expect(stats.totalEntries).toBe(1);
        expect(stats.validEntries).toBe(0);
        done();
      }, 4000);
    }, 10000);
  });

  describe('cache key generation', () => {
    it('should generate same key for identical diffs', () => {
      cacheReview(testDiff, null, mockReviewResult);

      const cached1 = getCachedReview(testDiff, null);
      const cached2 = getCachedReview(testDiff, null);

      expect(cached1).not.toBeNull();
      expect(cached2).not.toBeNull();
      expect(cached1).toEqual(cached2);
    });

    it('should generate different keys for different whitespace', () => {
      const diff1 = 'test\ncode';
      const diff2 = 'test\n\ncode';

      cacheReview(diff1, null, { ...mockReviewResult, overallScore: 80 });
      cacheReview(diff2, null, { ...mockReviewResult, overallScore: 90 });

      const cached1 = getCachedReview(diff1, null);
      const cached2 = getCachedReview(diff2, null);

      expect(cached1?.overallScore).toBe(80);
      expect(cached2?.overallScore).toBe(90);
    });
  });
});
