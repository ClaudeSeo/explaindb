/**
 * Markdown 렌더링 유틸리티
 */

const DEFAULT_MAX_LENGTH = 100;

/**
 * 문자열 truncate 처리
 * maxLen 초과 시 "..." 추가
 */
export function truncate(str: string, maxLen = DEFAULT_MAX_LENGTH): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

/**
 * Markdown 테이블 셀용 escape 처리
 * - | → \|
 * - ` → ' (backtick을 작은따옴표로)
 * - \n, \r → 공백
 */
export function escapeTableCell(str: string): string {
  return str
    .replace(/\r/g, '')
    .replace(/\n/g, ' ')
    .replace(/\|/g, '\\|')
    .replace(/`/g, "'");
}

/**
 * truncate + escape 조합
 * 테이블 셀에 표시할 문자열 처리
 */
export function formatTableCell(str: string, maxLen = DEFAULT_MAX_LENGTH): string {
  return escapeTableCell(truncate(str, maxLen));
}
