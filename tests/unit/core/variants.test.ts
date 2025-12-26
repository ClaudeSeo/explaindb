import { test, expect, describe } from 'bun:test';
import {
  generateSignature,
  extractShapePaths,
  calculateDiff,
  analyzeVariants,
} from '../../../src/core/variants/signature';
import { diffPaths, calculateSimilarity, formatDiff } from '../../../src/core/variants/differ';

describe('generateSignature', () => {
  test('should generate consistent signatures', () => {
    const paths = ['a', 'b', 'c'];
    const sig1 = generateSignature(paths);
    const sig2 = generateSignature(paths);

    expect(sig1).toBe(sig2);
  });

  test('should generate different signatures for different paths', () => {
    const sig1 = generateSignature(['a', 'b']);
    const sig2 = generateSignature(['a', 'c']);

    expect(sig1).not.toBe(sig2);
  });

  test('should generate same signature regardless of order', () => {
    const sig1 = generateSignature(['a', 'b', 'c']);
    const sig2 = generateSignature(['c', 'a', 'b']);

    expect(sig1).toBe(sig2);
  });
});

describe('extractShapePaths', () => {
  test('should extract top-level paths', () => {
    const doc = { a: 1, b: 'hello', c: true };
    const paths = extractShapePaths(doc);

    expect(paths).toContain('a');
    expect(paths).toContain('b');
    expect(paths).toContain('c');
  });

  test('should extract nested paths up to maxDepth', () => {
    const doc = { user: { profile: { name: 'John' } } };
    const paths = extractShapePaths(doc, 2);

    // maxDepth 2 returns leaf paths up to depth 2
    expect(paths).toContain('user.profile.name');
  });

  test('should handle arrays as leaf nodes', () => {
    const doc = { tags: ['a', 'b', 'c'] };
    const paths = extractShapePaths(doc);

    expect(paths).toContain('tags');
    expect(paths).not.toContain('tags.0');
  });

  test('should handle null values', () => {
    const doc = { a: null, b: 1 };
    const paths = extractShapePaths(doc);

    expect(paths).toContain('b');
  });
});

describe('calculateDiff', () => {
  test('should find added paths', () => {
    const primary = ['a', 'b'];
    const variant = ['a', 'b', 'c'];

    const diff = calculateDiff(primary, variant);

    expect(diff.addedPaths).toContain('c');
    expect(diff.missingPaths).toHaveLength(0);
  });

  test('should find missing paths', () => {
    const primary = ['a', 'b', 'c'];
    const variant = ['a', 'b'];

    const diff = calculateDiff(primary, variant);

    expect(diff.addedPaths).toHaveLength(0);
    expect(diff.missingPaths).toContain('c');
  });

  test('should find both added and missing paths', () => {
    const primary = ['a', 'b'];
    const variant = ['a', 'c'];

    const diff = calculateDiff(primary, variant);

    expect(diff.addedPaths).toContain('c');
    expect(diff.missingPaths).toContain('b');
  });
});

describe('analyzeVariants', () => {
  test('should identify single variant', () => {
    const docs = [
      { a: 1, b: 2 },
      { a: 3, b: 4 },
    ];

    const variants = analyzeVariants(docs);

    expect(variants).toHaveLength(1);
    expect(variants[0].ratio).toBe(1);
    expect(variants[0].count).toBe(2);
  });

  test('should identify multiple variants', () => {
    const docs = [
      { a: 1, b: 2 },
      { a: 3, b: 4 },
      { a: 5, c: 6 }, // different shape
    ];

    const variants = analyzeVariants(docs);

    expect(variants.length).toBeGreaterThanOrEqual(2);
  });

  test('should sort variants by count', () => {
    const docs = [
      { a: 1, b: 2 },
      { a: 3, b: 4 },
      { a: 5, b: 6 },
      { a: 7, c: 8 }, // less common
    ];

    const variants = analyzeVariants(docs);

    expect(variants[0].count).toBeGreaterThanOrEqual(variants[1]?.count || 0);
  });

  test('should respect topN limit', () => {
    const docs = [
      { a: 1 },
      { b: 2 },
      { c: 3 },
      { d: 4 },
      { e: 5 },
    ];

    const variants = analyzeVariants(docs, { topN: 3 });

    expect(variants.length).toBeLessThanOrEqual(3);
  });

  test('should calculate diff from primary', () => {
    const docs = [
      { a: 1, b: 2 },
      { a: 3, b: 4 },
      { a: 5, c: 6 }, // has 'c' instead of 'b'
    ];

    const variants = analyzeVariants(docs);

    // Primary should have empty diff
    expect(variants[0].diff.addedPaths).toHaveLength(0);
    expect(variants[0].diff.missingPaths).toHaveLength(0);
  });

  test('should handle empty documents array', () => {
    const variants = analyzeVariants([]);

    expect(variants).toHaveLength(0);
  });
});

describe('diffPaths', () => {
  test('should work like calculateDiff', () => {
    const base = ['a', 'b'];
    const compare = ['a', 'c'];

    const diff = diffPaths(base, compare);

    expect(diff.addedPaths).toContain('c');
    expect(diff.missingPaths).toContain('b');
  });
});

describe('calculateSimilarity', () => {
  test('should return 1 for identical sets', () => {
    expect(calculateSimilarity(['a', 'b'], ['a', 'b'])).toBe(1);
  });

  test('should return 0 for completely different sets', () => {
    expect(calculateSimilarity(['a', 'b'], ['c', 'd'])).toBe(0);
  });

  test('should return value between 0 and 1 for partial overlap', () => {
    const similarity = calculateSimilarity(['a', 'b', 'c'], ['a', 'b', 'd']);
    expect(similarity).toBeGreaterThan(0);
    expect(similarity).toBeLessThan(1);
  });

  test('should handle empty sets', () => {
    expect(calculateSimilarity([], [])).toBe(1);
  });
});

describe('formatDiff', () => {
  test('should format added paths', () => {
    const diff = { addedPaths: ['a', 'b'], missingPaths: [] };
    const formatted = formatDiff(diff);

    expect(formatted).toContain('+');
    expect(formatted).toContain('a');
  });

  test('should format missing paths', () => {
    const diff = { addedPaths: [], missingPaths: ['a', 'b'] };
    const formatted = formatDiff(diff);

    expect(formatted).toContain('-');
    expect(formatted).toContain('a');
  });

  test('should return dash for no diff', () => {
    const diff = { addedPaths: [], missingPaths: [] };
    const formatted = formatDiff(diff);

    expect(formatted).toBe('-');
  });
});
