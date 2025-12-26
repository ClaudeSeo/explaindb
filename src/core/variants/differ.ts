import type { VariantDiff } from '../../types/schema';
import { sortPaths } from '../../utils/sort';

/**
 * 두 path 세트 간의 차이 계산
 */
export function diffPaths(basePaths: string[], comparePaths: string[]): VariantDiff {
  const baseSet = new Set(basePaths);
  const compareSet = new Set(comparePaths);

  const addedPaths: string[] = [];
  const missingPaths: string[] = [];

  // base에 없고 compare에 추가된 path 찾기
  for (const path of comparePaths) {
    if (!baseSet.has(path)) {
      addedPaths.push(path);
    }
  }

  // base에 있고 compare에 없는 path 찾기
  for (const path of basePaths) {
    if (!compareSet.has(path)) {
      missingPaths.push(path);
    }
  }

  return {
    addedPaths: sortPaths(addedPaths),
    missingPaths: sortPaths(missingPaths),
  };
}

/**
 * 두 path 세트 간의 유사도 비율 계산
 * 0 (완전히 다름)과 1 (동일) 사이의 값 반환
 */
export function calculateSimilarity(paths1: string[], paths2: string[]): number {
  const set1 = new Set(paths1);
  const set2 = new Set(paths2);

  let intersection = 0;
  for (const path of set1) {
    if (set2.has(path)) {
      intersection++;
    }
  }

  const union = set1.size + set2.size - intersection;

  if (union === 0) {
    return 1; // 둘 다 비어있음
  }

  return intersection / union;
}

/**
 * 표시용 diff 포맷
 */
export function formatDiff(diff: VariantDiff): string {
  const parts: string[] = [];

  if (diff.addedPaths.length > 0) {
    const added = diff.addedPaths.slice(0, 3);
    const suffix = diff.addedPaths.length > 3 ? `... (+${diff.addedPaths.length - 3} more)` : '';
    parts.push(`+${added.join(', ')}${suffix}`);
  }

  if (diff.missingPaths.length > 0) {
    const missing = diff.missingPaths.slice(0, 3);
    const suffix = diff.missingPaths.length > 3 ? `... (+${diff.missingPaths.length - 3} more)` : '';
    parts.push(`-${missing.join(', ')}${suffix}`);
  }

  return parts.join(', ') || '-';
}
