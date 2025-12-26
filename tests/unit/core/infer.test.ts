import { test, expect, describe } from 'bun:test';
import { BsonType, detectBsonType } from '../../../src/types/bson';
import { getTypeDistribution, hasMixedTypes, isNumericType } from '../../../src/core/infer/analyzer';
import { aggregatePath, aggregateAll } from '../../../src/core/infer/aggregator';
import { calculateStats, percentile, stdDev } from '../../../src/core/infer/stats';
import type { PathValue } from '../../../src/types/schema';

describe('detectBsonType', () => {
  test('should detect null', () => {
    expect(detectBsonType(null)).toBe(BsonType.Null);
  });

  test('should detect undefined', () => {
    expect(detectBsonType(undefined)).toBe(BsonType.Undefined);
  });

  test('should detect boolean', () => {
    expect(detectBsonType(true)).toBe(BsonType.Boolean);
    expect(detectBsonType(false)).toBe(BsonType.Boolean);
  });

  test('should detect string', () => {
    expect(detectBsonType('hello')).toBe(BsonType.String);
  });

  test('should detect integers as int', () => {
    expect(detectBsonType(42)).toBe(BsonType.Int);
    expect(detectBsonType(-100)).toBe(BsonType.Int);
  });

  test('should detect large integers as long', () => {
    expect(detectBsonType(9007199254740991)).toBe(BsonType.Long);
  });

  test('should detect floats as double', () => {
    expect(detectBsonType(3.14)).toBe(BsonType.Double);
  });

  test('should detect arrays', () => {
    expect(detectBsonType([1, 2, 3])).toBe(BsonType.Array);
  });

  test('should detect objects', () => {
    expect(detectBsonType({ a: 1 })).toBe(BsonType.Object);
  });

  test('should detect dates', () => {
    expect(detectBsonType(new Date())).toBe(BsonType.Date);
  });

  test('should detect regex', () => {
    expect(detectBsonType(/test/)).toBe(BsonType.Regex);
  });
});

describe('getTypeDistribution', () => {
  test('should count type occurrences', () => {
    const values: PathValue[] = [
      { value: 'a', type: BsonType.String, docIndex: 0 },
      { value: 'b', type: BsonType.String, docIndex: 1 },
      { value: 1, type: BsonType.Int, docIndex: 2 },
    ];

    const dist = getTypeDistribution(values);

    expect(dist.get(BsonType.String)).toBe(2);
    expect(dist.get(BsonType.Int)).toBe(1);
  });
});

describe('hasMixedTypes', () => {
  test('should return false for single type', () => {
    const counts = new Map<BsonType, number>([[BsonType.String, 10]]);
    expect(hasMixedTypes(counts)).toBe(false);
  });

  test('should return true for multiple meaningful types', () => {
    const counts = new Map<BsonType, number>([
      [BsonType.String, 5],
      [BsonType.Int, 5],
    ]);
    expect(hasMixedTypes(counts)).toBe(true);
  });

  test('should ignore null/undefined in mixed type check', () => {
    const counts = new Map<BsonType, number>([
      [BsonType.String, 8],
      [BsonType.Null, 2],
    ]);
    expect(hasMixedTypes(counts)).toBe(false);
  });
});

describe('isNumericType', () => {
  test('should return true for numeric types', () => {
    expect(isNumericType(BsonType.Int)).toBe(true);
    expect(isNumericType(BsonType.Long)).toBe(true);
    expect(isNumericType(BsonType.Double)).toBe(true);
    expect(isNumericType(BsonType.Decimal)).toBe(true);
  });

  test('should return false for non-numeric types', () => {
    expect(isNumericType(BsonType.String)).toBe(false);
    expect(isNumericType(BsonType.Boolean)).toBe(false);
    expect(isNumericType(BsonType.Array)).toBe(false);
  });
});

describe('calculateStats', () => {
  test('should calculate min/max/avg', () => {
    const stats = calculateStats([10, 20, 30, 40, 50]);

    expect(stats.min).toBe(10);
    expect(stats.max).toBe(50);
    expect(stats.avg).toBe(30);
  });

  test('should handle single value', () => {
    const stats = calculateStats([42]);

    expect(stats.min).toBe(42);
    expect(stats.max).toBe(42);
    expect(stats.avg).toBe(42);
  });

  test('should handle empty array', () => {
    const stats = calculateStats([]);

    expect(stats.min).toBe(0);
    expect(stats.max).toBe(0);
    expect(stats.avg).toBe(0);
  });
});

describe('percentile', () => {
  test('should calculate median (50th percentile)', () => {
    expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3);
  });

  test('should calculate 90th percentile', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentile(values, 90)).toBe(9.1);
  });
});

describe('stdDev', () => {
  test('should calculate standard deviation', () => {
    const values = [2, 4, 4, 4, 5, 5, 7, 9];
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const sd = stdDev(values, avg);

    expect(sd).toBeCloseTo(2, 0);
  });
});

describe('aggregatePath', () => {
  test('should calculate presence ratio', () => {
    const values: PathValue[] = [
      { value: 'a', type: BsonType.String, docIndex: 0 },
      { value: 'b', type: BsonType.String, docIndex: 1 },
    ];

    const schema = aggregatePath('field', values, { totalDocs: 4 });

    expect(schema.presentRatio).toBe(0.5);
    expect(schema.presentCount).toBe(2);
    expect(schema.absentCount).toBe(2);
  });

  test('should detect optional fields', () => {
    const values: PathValue[] = [
      { value: 'a', type: BsonType.String, docIndex: 0 },
    ];

    const schema = aggregatePath('field', values, {
      totalDocs: 10,
      optionalThreshold: 0.95,
    });

    expect(schema.optional).toBe(true);
  });

  test('should detect mixed types', () => {
    const values: PathValue[] = [
      { value: 'a', type: BsonType.String, docIndex: 0 },
      { value: 1, type: BsonType.Int, docIndex: 1 },
    ];

    const schema = aggregatePath('field', values, { totalDocs: 2 });

    expect(schema.mixedType).toBe(true);
  });

  test('should calculate stats for numeric fields', () => {
    const values: PathValue[] = [
      { value: 10, type: BsonType.Int, docIndex: 0 },
      { value: 20, type: BsonType.Int, docIndex: 1 },
      { value: 30, type: BsonType.Int, docIndex: 2 },
    ];

    const schema = aggregatePath('field', values, { totalDocs: 3 });

    expect(schema.stats).not.toBeNull();
    expect(schema.stats?.min).toBe(10);
    expect(schema.stats?.max).toBe(30);
    expect(schema.stats?.avg).toBe(20);
  });
});

describe('aggregateAll', () => {
  test('should aggregate all paths', () => {
    const paths = new Map<string, PathValue[]>([
      ['name', [{ value: 'John', type: BsonType.String, docIndex: 0 }]],
      ['age', [{ value: 30, type: BsonType.Int, docIndex: 0 }]],
    ]);

    const schemas = aggregateAll(paths, { totalDocs: 1 });

    expect(schemas.length).toBe(2);
    expect(schemas.find((s) => s.path === 'name')).toBeDefined();
    expect(schemas.find((s) => s.path === 'age')).toBeDefined();
  });

  test('should skip array metadata paths but include array child fields', () => {
    const paths = new Map<string, PathValue[]>([
      ['tags', [{ value: ['a', 'b'], type: BsonType.Array, docIndex: 0 }]],
      ['tags.[*]', [{ value: '[string]', type: BsonType.String, docIndex: 0 }]], // 메타데이터 - 제외
    ]);

    const schemas = aggregateAll(paths, { totalDocs: 1 });

    expect(schemas.length).toBe(1);
    expect(schemas[0].path).toBe('tags');
  });

  test('should include array child fields', () => {
    const paths = new Map<string, PathValue[]>([
      ['agreements', [{ value: [{ _id: '1' }], type: BsonType.Array, docIndex: 0 }]],
      ['agreements.[*]', [{ value: '[object]', type: BsonType.Object, docIndex: 0 }]], // 메타데이터 - 제외
      ['agreements.[*]._id', [{ value: '1', type: BsonType.String, docIndex: 0 }]], // 하위 필드 - 포함
      ['agreements.[*].status', [{ value: 'active', type: BsonType.String, docIndex: 0 }]], // 하위 필드 - 포함
    ]);

    const schemas = aggregateAll(paths, { totalDocs: 1 });

    expect(schemas.length).toBe(3);
    expect(schemas.map(s => s.path).sort()).toEqual([
      'agreements',
      'agreements.[*]._id',
      'agreements.[*].status',
    ]);
  });

  test('should sort paths deterministically', () => {
    const paths = new Map<string, PathValue[]>([
      ['z', [{ value: 1, type: BsonType.Int, docIndex: 0 }]],
      ['a', [{ value: 2, type: BsonType.Int, docIndex: 0 }]],
      ['m', [{ value: 3, type: BsonType.Int, docIndex: 0 }]],
    ]);

    const schemas = aggregateAll(paths, { totalDocs: 1 });

    expect(schemas[0].path).toBe('a');
    expect(schemas[1].path).toBe('m');
    expect(schemas[2].path).toBe('z');
  });
});
