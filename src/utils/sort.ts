/**
 * 안정적인 정렬로 결정론적 출력 보장
 * 자연스러운 순서로 문자열 정렬 (숫자 접미사 처리)
 */
export function stableSort<T>(arr: T[], keyFn: (item: T) => string): T[] {
  return [...arr].sort((a, b) => {
    const keyA = keyFn(a);
    const keyB = keyFn(b);
    return keyA.localeCompare(keyB, undefined, { numeric: true, sensitivity: 'base' });
  });
}

/**
 * 결정론적 JSON 출력을 위한 객체 키 정렬
 */
export function sortObjectKeys<T extends Record<string, unknown>>(obj: T): T {
  const sorted = {} as T;
  const keys = Object.keys(obj).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  );
  for (const key of keys) {
    (sorted as Record<string, unknown>)[key] = obj[key];
  }
  return sorted;
}

/**
 * 재귀적으로 객체 키를 깊이 정렬
 */
export function deepSortKeys(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(deepSortKeys);
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(obj).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );
    for (const key of keys) {
      sorted[key] = deepSortKeys(obj[key]);
    }
    return sorted;
  }
  return value;
}

/**
 * 점으로 구분된 세그먼트별로 경로 정렬
 */
export function sortPaths(paths: string[]): string[] {
  return [...paths].sort((a, b) => {
    const partsA = a.split('.');
    const partsB = b.split('.');
    const minLen = Math.min(partsA.length, partsB.length);

    for (let i = 0; i < minLen; i++) {
      const cmp = partsA[i].localeCompare(partsB[i], undefined, { numeric: true, sensitivity: 'base' });
      if (cmp !== 0) return cmp;
    }

    return partsA.length - partsB.length;
  });
}
