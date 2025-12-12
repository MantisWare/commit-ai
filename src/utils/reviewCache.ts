import { createHash } from 'crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { ReviewResult } from '../commands/review';

const CACHE_DIR = join(homedir(), '.commit-ai-cache');
const CACHE_FILE = join(CACHE_DIR, 'review-cache.json');
const CACHE_VERSION = 1;
const DEFAULT_CACHE_TTL_HOURS = 24; // 24 hours default

interface CacheEntry {
  version: number;
  diffHash: string;
  standardsHash: string | null;
  result: ReviewResult;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

interface CacheStore {
  version: number;
  entries: Record<string, CacheEntry>;
}

/**
 * Generate a hash from a string
 */
function generateHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Get cache TTL from environment or config
 */
function getCacheTTL(): number {
  const ttlHours = process.env.CMT_REVIEW_CACHE_TTL
    ? parseInt(process.env.CMT_REVIEW_CACHE_TTL, 10)
    : DEFAULT_CACHE_TTL_HOURS;

  return ttlHours * 60 * 60 * 1000; // Convert hours to milliseconds
}

/**
 * Ensure cache directory exists
 */
function ensureCacheDirectory(): void {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
}

/**
 * Load cache from disk
 */
function loadCache(): CacheStore {
  ensureCacheDirectory();

  if (!existsSync(CACHE_FILE)) {
    return { version: CACHE_VERSION, entries: {} };
  }

  try {
    const content = readFileSync(CACHE_FILE, 'utf-8');
    const cache: CacheStore = JSON.parse(content);

    // Migrate or reset if version mismatch
    if (cache.version !== CACHE_VERSION) {
      return { version: CACHE_VERSION, entries: {} };
    }

    return cache;
  } catch (error) {
    // If cache is corrupted, start fresh
    return { version: CACHE_VERSION, entries: {} };
  }
}

/**
 * Save cache to disk
 */
function saveCache(cache: CacheStore): void {
  ensureCacheDirectory();

  try {
    writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (error) {
    // Fail silently - caching is optional
    console.error('Warning: Failed to save review cache:', error);
  }
}

/**
 * Clean expired entries from cache
 */
function cleanExpiredEntries(cache: CacheStore): CacheStore {
  const now = Date.now();
  const cleaned: Record<string, CacheEntry> = {};

  for (const [key, entry] of Object.entries(cache.entries)) {
    const age = now - entry.timestamp;
    if (age < entry.ttl) {
      cleaned[key] = entry;
    }
  }

  return { ...cache, entries: cleaned };
}

/**
 * Get cached review result if available and not expired
 * @param diff - The git diff to review
 * @param standards - Optional code standards content
 * @returns Cached review result or null if not found/expired
 */
export function getCachedReview(diff: string, standards: string | null = null): ReviewResult | null {
  // If caching is disabled, return null
  if (process.env.CMT_REVIEW_CACHE_DISABLED === 'true') {
    return null;
  }

  const cache = loadCache();
  const diffHash = generateHash(diff);
  const standardsHash = standards ? generateHash(standards) : null;
  const cacheKey = standardsHash ? `${diffHash}:${standardsHash}` : diffHash;

  const entry = cache.entries[cacheKey];

  if (!entry) {
    return null;
  }

  // Check if entry is expired
  const now = Date.now();
  const age = now - entry.timestamp;

  if (age >= entry.ttl) {
    return null; // Expired
  }

  // Return cached result
  return entry.result;
}

/**
 * Cache a review result
 * @param diff - The git diff that was reviewed
 * @param standards - Optional code standards content
 * @param result - The review result to cache
 */
export function cacheReview(diff: string, standards: string | null, result: ReviewResult): void {
  // If caching is disabled, skip
  if (process.env.CMT_REVIEW_CACHE_DISABLED === 'true') {
    return;
  }

  const cache = loadCache();
  const cleanedCache = cleanExpiredEntries(cache);

  const diffHash = generateHash(diff);
  const standardsHash = standards ? generateHash(standards) : null;
  const cacheKey = standardsHash ? `${diffHash}:${standardsHash}` : diffHash;

  const entry: CacheEntry = {
    version: CACHE_VERSION,
    diffHash,
    standardsHash,
    result,
    timestamp: Date.now(),
    ttl: getCacheTTL()
  };

  cleanedCache.entries[cacheKey] = entry;
  saveCache(cleanedCache);
}

/**
 * Clear all cached review results
 */
export function clearReviewCache(): void {
  ensureCacheDirectory();

  const emptyCache: CacheStore = {
    version: CACHE_VERSION,
    entries: {}
  };

  saveCache(emptyCache);
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { totalEntries: number; validEntries: number; cacheSize: string } {
  const cache = loadCache();
  const cleanedCache = cleanExpiredEntries(cache);

  const totalEntries = Object.keys(cache.entries).length;
  const validEntries = Object.keys(cleanedCache.entries).length;

  let cacheSize = '0 KB';
  if (existsSync(CACHE_FILE)) {
    try {
      const stats = require('fs').statSync(CACHE_FILE);
      cacheSize = `${(stats.size / 1024).toFixed(2)} KB`;
    } catch (error) {
      // Ignore
    }
  }

  return { totalEntries, validEntries, cacheSize };
}
