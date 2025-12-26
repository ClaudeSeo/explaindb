import type { Variant, VariantDiff } from '../../types/schema';
import { sha256 } from '../../utils/hash';
import { sortPaths } from '../../utils/sort';

// 변종 분석 상수
const DEFAULT_SHAPE_MAX_DEPTH = 2;
const SIGNATURE_PREFIX_LENGTH = 8;

export interface VariantOptions {
  topN: number;
}

const DEFAULT_OPTIONS: VariantOptions = {
  topN: 10,
};

/**
 * 필드 path를 기반으로 문서 shape의 signature 생성
 */
export function generateSignature(paths: string[]): string {
  const sorted = sortPaths(paths);
  return sha256(sorted.join('|'));
}

/**
 * 문서에서 최상위 및 중첩된 path 추출
 */
export function extractShapePaths(doc: Record<string, unknown>, maxDepth = DEFAULT_SHAPE_MAX_DEPTH): string[] {
  const paths: string[] = [];

  function traverse(obj: unknown, currentPath: string, depth: number): void {
    if (depth > maxDepth) {
      if (currentPath) paths.push(currentPath);
      return;
    }

    // 프리미티브 및 null 처리
    if (obj === null || obj === undefined || typeof obj !== 'object') {
      if (currentPath) paths.push(currentPath);
      return;
    }

    // Array 처리
    if (Array.isArray(obj)) {
      if (currentPath) paths.push(currentPath);
      return;
    }

    // Date 처리
    if (obj instanceof Date) {
      if (currentPath) paths.push(currentPath);
      return;
    }

    const record = obj as Record<string, unknown>;

    // BSON 타입 체크
    if (record._bsontype) {
      if (currentPath) paths.push(currentPath);
      return;
    }

    // 객체 - 키들 순회
    for (const key of Object.keys(record)) {
      const newPath = currentPath ? `${currentPath}.${key}` : key;
      traverse(record[key], newPath, depth + 1);
    }
  }

  traverse(doc, '', 0);
  return paths;
}

/**
 * 두 path 세트 간의 차이 계산
 */
export function calculateDiff(primaryPaths: string[], variantPaths: string[]): VariantDiff {
  const primarySet = new Set(primaryPaths);
  const variantSet = new Set(variantPaths);

  const addedPaths = variantPaths.filter((p) => !primarySet.has(p));
  const missingPaths = primaryPaths.filter((p) => !variantSet.has(p));

  return {
    addedPaths: sortPaths(addedPaths),
    missingPaths: sortPaths(missingPaths),
  };
}

/**
 * 문서 변종 분석
 */
export function analyzeVariants(
  documents: Record<string, unknown>[],
  options: Partial<VariantOptions> = {}
): Variant[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (documents.length === 0) {
    return [];
  }

  // signature별로 문서 그룹화
  const signatureGroups = new Map<string, { paths: string[]; count: number }>();

  for (const doc of documents) {
    const paths = extractShapePaths(doc);
    const sig = generateSignature(paths);

    const existing = signatureGroups.get(sig);
    if (existing) {
      existing.count++;
    } else {
      signatureGroups.set(sig, { paths, count: 1 });
    }
  }

  // 카운트로 정렬하고 상위 N개 추출
  const sorted = Array.from(signatureGroups.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, opts.topN);

  if (sorted.length === 0) {
    return [];
  }

  const totalDocs = documents.length;
  const primaryPaths = sorted[0][1].paths;

  return sorted.map(([signature, { paths, count }], index) => {
    const diff = index === 0 ? { addedPaths: [], missingPaths: [] } : calculateDiff(primaryPaths, paths);

    return {
      signature: signature.substring(0, SIGNATURE_PREFIX_LENGTH),
      count,
      ratio: count / totalDocs,
      paths,
      diff,
    };
  });
}
