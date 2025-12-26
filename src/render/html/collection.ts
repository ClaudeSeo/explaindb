/**
 * HTML 테이블 렌더링 - 컬렉션 필드 테이블
 */

import type { BsonType } from '../../types/bson';
import type { FieldSchema } from '../../types/schema';
import { escapeHtml } from './utils';
import { buildFieldTree, flattenTree, type FieldTreeNode } from './tree';

// 렌더링 표시 제한 상수
const MAX_EXAMPLES_DISPLAY = 3;

/**
 * 활성 rowspan 추적용 인터페이스
 */
interface ActiveRowspan {
  remaining: number; // 남은 행 수
  depth: number; // rowspan이 적용된 depth
}

/**
 * 타입 비율 표시용 포맷팅
 */
function formatTypeRatio(typeRatio: Partial<Record<BsonType, number>>): string {
  const entries = Object.entries(typeRatio) as [BsonType, number][];
  if (entries.length === 0) return '-';

  const firstEntry = entries[0];
  if (entries.length === 1 && firstEntry) return firstEntry[0];

  return entries
    .sort((a, b) => b[1] - a[1])
    .map(([type, ratio]) => `${type}(${Math.round(ratio * 100)}%)`)
    .join(', ');
}

/**
 * 예제 표시용 포맷팅 (HTML 이스케이프 적용)
 */
function formatExamples(field: FieldSchema): string {
  if (field.examples.length === 0) return '-';

  return field.examples
    .slice(0, MAX_EXAMPLES_DISPLAY)
    .map((e) => `<code>${escapeHtml(e.value)}</code>`)
    .join(', ');
}

/**
 * 필드 노트 포맷팅
 */
function formatNotes(field: FieldSchema): string {
  const notes: string[] = [];

  if (field.mixedType) {
    notes.push('Mixed');
  }

  if (field.hints.length > 0) {
    notes.push(`PII: ${field.hints.join(', ')}`);
  }

  if (field.stats) {
    notes.push(`min: ${field.stats.min.toFixed(2)}, max: ${field.stats.max.toFixed(2)}`);
  }

  return notes.length > 0 ? notes.join(' | ') : '-';
}

/**
 * flatNodes에서 최대 depth 계산
 */
function getMaxDepth(flatNodes: FieldTreeNode[]): number {
  if (flatNodes.length === 0) return 1;
  return Math.max(...flatNodes.map((node) => node.depth));
}


/**
 * 필드 HTML 테이블 렌더링
 * 다중 컬럼 Path 구조로 중첩 표현
 */
export function renderFieldsHtmlTable(fields: FieldSchema[]): string[] {
  const lines: string[] = [];

  // 트리 구조 생성
  const root = buildFieldTree(fields);
  const flatNodes = flattenTree(root);
  const maxDepth = getMaxDepth(flatNodes);

  // 테이블 헤더
  lines.push('<table>');
  lines.push('  <thead>');
  lines.push('    <tr>');
  lines.push(`      <th colspan="${maxDepth}">Path</th>`);
  lines.push('      <th>Present%</th>');
  lines.push('      <th>Types</th>');
  lines.push('      <th>Optional</th>');
  lines.push('      <th>Examples</th>');
  lines.push('      <th>Description</th>');
  lines.push('      <th>Notes</th>');
  lines.push('    </tr>');
  lines.push('  </thead>');
  lines.push('  <tbody>');

  // 활성 rowspan 스택 관리
  const activeRowspans: ActiveRowspan[] = [];

  // 각 노드를 행으로 렌더링
  for (const node of flatNodes) {
    const field = node.field;
    const hasChildren = node.children.length > 0;

    // 필드가 없는 중간 노드는 건너뜀 (자식만 있는 가상 노드)
    if (!field) continue;

    lines.push('    <tr>');

    // 활성 rowspan에 의해 커버되는 최대 depth 계산
    const coveredDepth = activeRowspans.length > 0
      ? Math.max(...activeRowspans.map((r) => r.depth))
      : 0;

    // Path 컬럼 렌더링
    const pathCells: string[] = [];
    const nodeDepth = node.depth;

    if (hasChildren && node.rowspan > 1) {
      // 부모 노드: rowspan 적용 + 빈 셀들
      pathCells.push(`      <td rowspan="${node.rowspan}">${escapeHtml(node.segment)}</td>`);
      // 남은 Path 컬럼을 빈 셀로 채움
      const remainingCols = maxDepth - nodeDepth;
      if (remainingCols > 0) {
        pathCells.push(`      <td colspan="${remainingCols}"></td>`);
      }
      // 활성 rowspan 스택에 추가
      activeRowspans.push({ remaining: node.rowspan - 1, depth: nodeDepth });
    } else if (coveredDepth > 0) {
      // 부모의 rowspan 범위 내에 있는 자식 노드
      // coveredDepth까지의 컬럼은 부모의 rowspan에 의해 이미 커버됨
      const remainingCols = maxDepth - nodeDepth + 1;
      if (remainingCols > 1) {
        pathCells.push(`      <td colspan="${remainingCols}">${escapeHtml(node.segment)}</td>`);
      } else {
        pathCells.push(`      <td>${escapeHtml(node.segment)}</td>`);
      }
    } else {
      // 최상위 leaf 노드 (부모 없음)
      const remainingCols = maxDepth - nodeDepth + 1;
      if (remainingCols > 1) {
        pathCells.push(`      <td colspan="${remainingCols}">${escapeHtml(node.segment)}</td>`);
      } else {
        pathCells.push(`      <td>${escapeHtml(node.segment)}</td>`);
      }
    }

    for (const cell of pathCells) {
      lines.push(cell);
    }

    // 나머지 컬럼들
    const presentPct = `${Math.round(field.presentRatio * 100)}%`;
    const types = escapeHtml(formatTypeRatio(field.typeRatio));
    const optional = field.optional ? 'Yes' : 'No';
    const examples = formatExamples(field);
    const description = escapeHtml(field.description || '-');
    const notes = escapeHtml(formatNotes(field));

    lines.push(`      <td>${presentPct}</td>`);
    lines.push(`      <td>${types}</td>`);
    lines.push(`      <td>${optional}</td>`);
    lines.push(`      <td>${examples}</td>`);
    lines.push(`      <td>${description}</td>`);
    lines.push(`      <td>${notes}</td>`);
    lines.push('    </tr>');

    // 활성 rowspan의 remaining 감소 및 만료된 것 제거
    for (let i = activeRowspans.length - 1; i >= 0; i--) {
      const rowspan = activeRowspans[i];
      if (rowspan) {
        rowspan.remaining--;
        if (rowspan.remaining <= 0) {
          activeRowspans.splice(i, 1);
        }
      }
    }
  }

  lines.push('  </tbody>');
  lines.push('</table>');

  return lines;
}
