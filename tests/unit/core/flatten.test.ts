import { test, expect, describe } from 'bun:test';
import { flatten, mergeFlattenResults } from '../../../src/core/flatten/flattener';
import { escapeKey, unescapeKey, joinPath, splitPath } from '../../../src/core/flatten/escaping';
import { BsonType } from '../../../src/types/bson';

describe('escaping', () => {
  test('escapeKey should escape dots', () => {
    // In source, backslash is escaped, so '\\.' in source = '\.' in output
    const escaped = escapeKey('user.name');
    expect(escaped).toContain('.');
    expect(escaped.includes('\\.')).toBe(true);
  });

  test('escapeKey should escape dollar signs', () => {
    const escaped = escapeKey('$set');
    expect(escaped.includes('\\$')).toBe(true);
  });

  test('escapeKey should escape backslashes', () => {
    const escaped = escapeKey('path\\to');
    expect(escaped.includes('\\\\')).toBe(true);
  });

  test('unescapeKey should reverse escaping', () => {
    // Round-trip test
    const original1 = 'user.name';
    expect(unescapeKey(escapeKey(original1))).toBe(original1);

    const original2 = '$set';
    expect(unescapeKey(escapeKey(original2))).toBe(original2);
  });

  test('joinPath should join segments with dots', () => {
    expect(joinPath('user', 'profile', 'name')).toBe('user.profile.name');
  });

  test('splitPath should split on unescaped dots', () => {
    expect(splitPath('user.profile.name')).toEqual(['user', 'profile', 'name']);
    expect(splitPath('user\\.name.age')).toEqual(['user\\.name', 'age']);
  });
});

describe('flatten', () => {
  test('should flatten simple document', () => {
    const doc = {
      _id: '123',
      name: 'John',
      age: 30,
    };

    const result = flatten(doc, 0);

    expect(result.paths.has('_id')).toBe(true);
    expect(result.paths.has('name')).toBe(true);
    expect(result.paths.has('age')).toBe(true);
  });

  test('should flatten nested objects', () => {
    const doc = {
      user: {
        profile: {
          name: 'John',
        },
      },
    };

    const result = flatten(doc, 0);

    expect(result.paths.has('user')).toBe(true);
    expect(result.paths.has('user.profile')).toBe(true);
    expect(result.paths.has('user.profile.name')).toBe(true);
  });

  test('should flatten arrays', () => {
    const doc = {
      tags: ['a', 'b', 'c'],
    };

    const result = flatten(doc, 0);

    expect(result.paths.has('tags')).toBe(true);
    expect(result.paths.has('tags.[0]')).toBe(true);
    expect(result.paths.has('tags.[1]')).toBe(true);
    expect(result.paths.has('tags.[2]')).toBe(true);
    expect(result.paths.has('tags.[*]')).toBe(true);
  });

  test('should handle array of objects', () => {
    const doc = {
      items: [
        { name: 'item1', qty: 10 },
        { name: 'item2', qty: 5 },
      ],
    };

    const result = flatten(doc, 0);

    expect(result.paths.has('items')).toBe(true);
    expect(result.paths.has('items.[0]')).toBe(true);
    expect(result.paths.has('items.[0].name')).toBe(true);
    expect(result.paths.has('items.[0].qty')).toBe(true);
  });

  test('should detect types correctly', () => {
    const doc = {
      str: 'hello',
      num: 42,
      bool: true,
      nil: null,
      arr: [1, 2],
      obj: { a: 1 },
    };

    const result = flatten(doc, 0);

    const strValues = result.paths.get('str');
    expect(strValues?.[0].type).toBe(BsonType.String);

    const numValues = result.paths.get('num');
    expect(numValues?.[0].type).toBe(BsonType.Int);

    const boolValues = result.paths.get('bool');
    expect(boolValues?.[0].type).toBe(BsonType.Boolean);

    const nilValues = result.paths.get('nil');
    expect(nilValues?.[0].type).toBe(BsonType.Null);

    const arrValues = result.paths.get('arr');
    expect(arrValues?.[0].type).toBe(BsonType.Array);

    const objValues = result.paths.get('obj');
    expect(objValues?.[0].type).toBe(BsonType.Object);
  });

  test('should respect maxDepth limit', () => {
    const doc = {
      a: { b: { c: { d: { e: { f: 'deep' } } } } },
    };

    const result = flatten(doc, 0, { maxDepth: 3 });

    expect(result.truncationCounters.depthTruncated).toBeGreaterThan(0);
  });

  test('should respect maxKeysPerDoc limit', () => {
    const doc: Record<string, number> = {};
    for (let i = 0; i < 200; i++) {
      doc[`key${i}`] = i;
    }

    const result = flatten(doc, 0, { maxKeysPerDoc: 50 });

    // Check that we only captured 50 keys
    expect(result.paths.size).toBeLessThanOrEqual(50);
    // The remaining keys should be truncated
    expect(result.truncationCounters.keysTruncated).toBe(200 - result.paths.size);
  });

  test('should respect maxArraySample limit', () => {
    const doc = {
      arr: Array.from({ length: 100 }, (_, i) => i),
    };

    const result = flatten(doc, 0, { maxArraySample: 10 });

    expect(result.truncationCounters.arraysTruncated).toBe(1);
  });
});

describe('mergeFlattenResults', () => {
  test('should merge multiple flatten results', () => {
    const result1 = flatten({ a: 1, b: 2 }, 0);
    const result2 = flatten({ a: 3, c: 4 }, 1);

    const merged = mergeFlattenResults([result1, result2]);

    expect(merged.paths.get('a')?.length).toBe(2);
    expect(merged.paths.has('b')).toBe(true);
    expect(merged.paths.has('c')).toBe(true);
  });

  test('should sum truncation counters', () => {
    const doc = { arr: Array.from({ length: 100 }, (_, i) => i) };

    const result1 = flatten(doc, 0, { maxArraySample: 10 });
    const result2 = flatten(doc, 1, { maxArraySample: 10 });

    const merged = mergeFlattenResults([result1, result2]);

    expect(merged.truncationCounters.arraysTruncated).toBe(2);
  });
});
