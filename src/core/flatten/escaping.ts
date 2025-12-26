/**
 * MongoDB path notation을 위한 키 이스케이핑 규칙
 * 필드명의 특수문자 처리
 */

/**
 * 필드 키의 특수문자를 이스케이핑
 * 순서가 중요함: 백슬래시를 먼저 이스케이핑하여 중복 이스케이핑 방지
 */
export function escapeKey(key: string): string {
  let result = key;
  // 백슬래시를 먼저 이스케이핑
  result = result.split('\\').join('\\\\');
  // 그 다음 다른 문자들 이스케이핑
  result = result.split('.').join('\\.');
  result = result.split('$').join('\\$');
  return result;
}

/**
 * path segment의 특수문자를 언이스케이핑
 */
export function unescapeKey(key: string): string {
  let result = key;
  // 역순으로 언이스케이핑
  result = result.split('\\\\').join('\x00'); // placeholder
  result = result.split('\\$').join('$');
  result = result.split('\\.').join('.');
  result = result.split('\x00').join('\\');
  return result;
}

/**
 * path segment들을 dot notation으로 결합
 */
export function joinPath(...segments: string[]): string {
  return segments.filter(Boolean).join('.');
}

/**
 * 이스케이핑된 dot을 고려하여 path를 segment로 분할
 */
export function splitPath(path: string): string[] {
  const segments: string[] = [];
  let current = '';
  let i = 0;

  while (i < path.length) {
    if (path[i] === '\\' && i + 1 < path.length) {
      // 이스케이핑된 문자
      current += path[i] + path[i + 1];
      i += 2;
    } else if (path[i] === '.') {
      // path 구분자
      if (current) {
        segments.push(current);
        current = '';
      }
      i++;
    } else {
      current += path[i];
      i++;
    }
  }

  if (current) {
    segments.push(current);
  }

  return segments;
}

/**
 * 배열 인덱스를 path notation으로 포맷
 */
export function formatArrayIndex(index: number): string {
  return `[${index}]`;
}

/**
 * path segment가 배열 인덱스인지 확인
 */
export function isArrayIndex(segment: string): boolean {
  return /^\[\d+\]$/.test(segment);
}

/**
 * path segment에서 배열 인덱스 추출
 */
export function parseArrayIndex(segment: string): number | null {
  const match = segment.match(/^\[(\d+)\]$/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * 배열 인덱스를 wildcard로 정규화
 * [0], [1], [2] 등을 모두 [*]로 변환
 */
export function normalizeArrayIndex(segment: string): string {
  return isArrayIndex(segment) ? '[*]' : segment;
}
