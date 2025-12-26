import type { FlattenResult, PathValue, TruncationCounters } from '../../types/schema';
import { BsonType, detectBsonType } from '../../types/bson';
import { escapeKey, joinPath, formatArrayIndex, normalizeArrayIndex, splitPath } from './escaping';
import { createLimits, type FlattenLimits } from './limits';

export type FlattenOptions = Partial<FlattenLimits>;

/**
 * 문서를 path-value 쌍으로 평탄화
 */
export function flatten(
  doc: Record<string, unknown>,
  docIndex: number,
  options: FlattenOptions = {}
): FlattenResult {
  const limits = createLimits(options);
  const paths = new Map<string, PathValue[]>();
  const counters: TruncationCounters = {
    depthTruncated: 0,
    keysTruncated: 0,
    arraysTruncated: 0,
  };

  let keyCount = 0;

  function addPath(path: string, value: unknown, type: BsonType): void {
    if (keyCount >= limits.maxKeysPerDoc) {
      counters.keysTruncated++;
      return;
    }

    const existing = paths.get(path) || [];
    existing.push({ value, type, docIndex });
    paths.set(path, existing);
    keyCount++;
  }

  function traverse(obj: unknown, currentPath: string, depth: number): void {
    if (depth > limits.maxDepth) {
      counters.depthTruncated++;
      addPath(currentPath + '.[TRUNCATED]', null, BsonType.Null);
      return;
    }

    if (keyCount >= limits.maxKeysPerDoc) {
      counters.keysTruncated++;
      return;
    }

    const type = detectBsonType(obj);

    // 프리미티브 및 특수 타입 처리
    if (obj === null || obj === undefined) {
      addPath(currentPath, obj, type);
      return;
    }

    if (typeof obj !== 'object') {
      addPath(currentPath, obj, type);
      return;
    }

    // Date 처리
    if (obj instanceof Date) {
      addPath(currentPath, obj, type);
      return;
    }

    // Array 처리
    if (Array.isArray(obj)) {
      addPath(currentPath, obj, type);

      // 배열 요소 샘플링
      const sampleSize = Math.min(obj.length, limits.maxArraySample);
      if (obj.length > limits.maxArraySample) {
        counters.arraysTruncated++;
      }

      // 요소 타입 추적
      const elementTypes = new Set<BsonType>();

      for (let i = 0; i < sampleSize; i++) {
        const element = obj[i];
        const elementType = detectBsonType(element);
        elementTypes.add(elementType);

        const elementPath = joinPath(currentPath, formatArrayIndex(i));

        if (elementType === BsonType.Object && element !== null) {
          traverse(element, elementPath, depth + 1);
        } else if (elementType === BsonType.Array) {
          traverse(element, elementPath, depth + 1);
        } else {
          addPath(elementPath, element, elementType);
        }
      }

      // 배열 요소 타입 정보를 위한 wildcard path 추가
      if (elementTypes.size > 0) {
        const wildcardPath = joinPath(currentPath, '[*]');
        for (const elemType of elementTypes) {
          addPath(wildcardPath, `[${elemType}]`, elemType);
        }
      }

      return;
    }

    // Object 처리 (MongoDB BSON 타입 포함)
    const objRecord = obj as Record<string, unknown>;

    // BSON 타입 체크
    if (objRecord._bsontype) {
      addPath(currentPath, obj, type);
      return;
    }

    // 일반 객체
    addPath(currentPath, obj, type);

    const keys = Object.keys(objRecord);
    for (const key of keys) {
      const escapedKey = escapeKey(key);
      const newPath = currentPath ? joinPath(currentPath, escapedKey) : escapedKey;
      traverse(objRecord[key], newPath, depth + 1);
    }
  }

  // 루트부터 순회 시작
  const keys = Object.keys(doc);
  for (const key of keys) {
    const escapedKey = escapeKey(key);
    traverse(doc[key], escapedKey, 1);
  }

  return { paths, truncationCounters: counters };
}

/**
 * path의 배열 인덱스를 wildcard로 정규화
 * agreements.[0], agreements.[1] -> agreements.[*]
 */
function normalizePathsToWildcard(paths: Map<string, PathValue[]>): Map<string, PathValue[]> {
  const normalized = new Map<string, PathValue[]>();

  for (const [path, values] of paths) {
    // path를 segment로 분할하고 배열 인덱스를 [*]로 변환
    const segments = splitPath(path);
    const normalizedSegments = segments.map(seg => normalizeArrayIndex(seg));
    const normalizedPath = joinPath(...normalizedSegments);

    // 동일 wildcard 경로의 값들을 병합
    const existing = normalized.get(normalizedPath) || [];
    normalized.set(normalizedPath, [...existing, ...values]);
  }

  return normalized;
}

/**
 * 여러 flatten 결과를 병합
 */
export function mergeFlattenResults(results: FlattenResult[]): FlattenResult {
  const merged = new Map<string, PathValue[]>();
  const counters: TruncationCounters = {
    depthTruncated: 0,
    keysTruncated: 0,
    arraysTruncated: 0,
  };

  for (const result of results) {
    // path 병합
    for (const [path, values] of result.paths) {
      const existing = merged.get(path) || [];
      merged.set(path, [...existing, ...values]);
    }

    // 카운터 합산
    counters.depthTruncated += result.truncationCounters.depthTruncated;
    counters.keysTruncated += result.truncationCounters.keysTruncated;
    counters.arraysTruncated += result.truncationCounters.arraysTruncated;
  }

  // 배열 인덱스를 wildcard로 정규화
  const normalizedPaths = normalizePathsToWildcard(merged);

  return { paths: normalizedPaths, truncationCounters: counters };
}
