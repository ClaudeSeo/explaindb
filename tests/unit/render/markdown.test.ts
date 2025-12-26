import { test, expect, describe } from 'bun:test';
import { renderReadme } from '../../../src/render/markdown/readme';
import { renderCollection } from '../../../src/render/markdown/collection';
import type { CollectionSchema, RunMeta } from '../../../src/types/schema';
import { BsonType } from '../../../src/types/bson';

describe('renderReadme', () => {
  const mockMeta: RunMeta = {
    generatedAt: '2024-01-01T00:00:00Z',
    database: 'testdb',
    sampling: {
      strategy: 'random',
      size: 100,
    },
    options: {
      maxDepth: 20,
      redact: 'on',
      llm: 'off',
    },
    truncationCounters: {
      depthTruncated: 0,
      keysTruncated: 0,
      arraysTruncated: 0,
    },
  };

  const mockCollections: CollectionSchema[] = [
    {
      name: 'users',
      estimatedCount: 1000,
      sampledCount: 100,
      indexes: [{ name: '_id_', key: { _id: 1 }, unique: true }],
      fields: [
        {
          path: '_id',
          presentRatio: 1,
          presentCount: 100,
          absentCount: 0,
          typeRatio: { [BsonType.ObjectId]: 1 },
          typeCounts: { [BsonType.ObjectId]: 100 },
          examples: [],
          stats: null,
          optional: false,
          mixedType: false,
          hints: [],
        },
      ],
      variants: [],
      warnings: [],
    },
  ];

  test('should render README header', () => {
    const result = renderReadme(mockCollections, mockMeta);

    expect(result).toContain('# Schema Documentation');
    expect(result).toContain('Database: testdb');
    expect(result).toContain('Collections: 1');
  });

  test('should render sampling options', () => {
    const result = renderReadme(mockCollections, mockMeta);

    expect(result).toContain('## Sampling Options');
    expect(result).toContain('Strategy: random');
    expect(result).toContain('Sample Size: 100');
  });

  test('should render collections table', () => {
    const result = renderReadme(mockCollections, mockMeta);

    expect(result).toContain('## Collections');
    expect(result).toContain('| Collection | Documents | Fields | Variants | Warnings |');
    expect(result).toContain('users');
  });

  test('should render truncation warnings when present', () => {
    const metaWithTruncation = {
      ...mockMeta,
      truncationCounters: {
        depthTruncated: 5,
        keysTruncated: 0,
        arraysTruncated: 0,
      },
    };

    const result = renderReadme(mockCollections, metaWithTruncation);

    expect(result).toContain('## Truncation Warnings');
    expect(result).toContain('Depth truncated: 5');
  });

  test('should render PII warnings', () => {
    const collectionsWithPII: CollectionSchema[] = [
      {
        ...mockCollections[0],
        fields: [
          {
            ...mockCollections[0].fields[0],
            path: 'email',
            hints: ['email'],
          },
        ],
      },
    ];

    const result = renderReadme(collectionsWithPII, mockMeta);

    expect(result).toContain('## Warnings');
    expect(result).toContain('PII-suspected fields');
  });
});

describe('renderCollection', () => {
  const mockSchema: CollectionSchema = {
    name: 'users',
    estimatedCount: 5000,
    sampledCount: 100,
    indexes: [
      { name: '_id_', key: { _id: 1 }, unique: true },
      { name: 'email_1', key: { email: 1 }, unique: true },
    ],
    fields: [
      {
        path: '_id',
        presentRatio: 1,
        presentCount: 100,
        absentCount: 0,
        typeRatio: { [BsonType.ObjectId]: 1 },
        typeCounts: { [BsonType.ObjectId]: 100 },
        examples: [{ value: '507f1f77...', type: BsonType.ObjectId, hints: [] }],
        stats: null,
        optional: false,
        mixedType: false,
        hints: [],
      },
      {
        path: 'email',
        presentRatio: 0.95,
        presentCount: 95,
        absentCount: 5,
        typeRatio: { [BsonType.String]: 1 },
        typeCounts: { [BsonType.String]: 95 },
        examples: [{ value: 'j***@e***.com', type: BsonType.String, hints: ['email'] }],
        stats: null,
        optional: true,
        mixedType: false,
        hints: ['email'],
      },
    ],
    variants: [
      {
        signature: 'abc12345',
        count: 80,
        ratio: 0.8,
        paths: ['_id', 'email'],
        diff: { addedPaths: [], missingPaths: [] },
      },
      {
        signature: 'def67890',
        count: 20,
        ratio: 0.2,
        paths: ['_id', 'email', 'phone'],
        diff: { addedPaths: ['phone'], missingPaths: [] },
      },
    ],
    warnings: ['PII detected'],
  };

  test('should render collection header', () => {
    const result = renderCollection(mockSchema);

    expect(result).toContain('# Collection: users');
    expect(result).toContain('Estimated Documents: ~5,000');
    expect(result).toContain('Sampled: 100');
  });

  test('should render fields table', () => {
    const result = renderCollection(mockSchema);

    expect(result).toContain('## Fields');
    expect(result).toContain('<table>');
    // Path 헤더는 maxDepth에 따라 colspan이 적용됨
    expect(result).toMatch(/<th colspan="\d+">Path<\/th>/);
    expect(result).toContain('_id');
    expect(result).toContain('email');
  });

  test('should render indexes table', () => {
    const result = renderCollection(mockSchema);

    expect(result).toContain('## Indexes');
    expect(result).toContain('_id_');
    expect(result).toContain('email_1');
  });

  test('should render variants table', () => {
    const result = renderCollection(mockSchema);

    expect(result).toContain('## Variants');
    expect(result).toContain('#1 (primary)');
    expect(result).toContain('80%');
  });

  test('should render warnings', () => {
    const result = renderCollection(mockSchema);

    expect(result).toContain('## Warnings');
    expect(result).toContain('PII detected');
  });

  test('should render summary when available', () => {
    const schemaWithSummary = {
      ...mockSchema,
      summary: 'This is a test summary.',
    };

    const result = renderCollection(schemaWithSummary);

    expect(result).toContain('## Summary');
    expect(result).toContain('This is a test summary.');
  });
});
