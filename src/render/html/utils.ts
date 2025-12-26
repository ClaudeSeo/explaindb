/**
 * HTML 렌더링 유틸리티
 */

/**
 * HTML 특수문자 이스케이프
 * <, >, &, " 문자를 HTML 엔티티로 변환
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
