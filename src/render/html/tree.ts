/**
 * 필드 스키마를 트리 구조로 변환하고 rowspan 계산
 */

import { splitPath } from '../../core/flatten/escaping';
import type { FieldSchema } from '../../types/schema';

/**
 * 필드 트리 노드
 */
export interface FieldTreeNode {
  segment: string; // 현재 세그먼트
  fullPath: string; // 전체 경로
  field: FieldSchema | null; // 해당 필드 스키마 (중간 노드는 null일 수 있음)
  children: FieldTreeNode[]; // 자식 노드들
  depth: number; // 깊이
  rowspan: number; // 계산된 rowspan
}

/**
 * 경로 세그먼트 결합 (빈 값 필터링)
 */
function joinPathSegments(segments: string[]): string {
  return segments.filter(Boolean).join('.');
}

/**
 * 필드를 트리에 삽입
 */
function insertField(root: FieldTreeNode, field: FieldSchema): void {
  const segments = splitPath(field.path);
  let current = root;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if (!segment) continue;

    const fullPath = joinPathSegments(segments.slice(0, i + 1));
    const isLast = i === segments.length - 1;

    // 기존 자식 노드 찾기
    let child = current.children.find((c) => c.segment === segment);

    if (!child) {
      // 새 노드 생성
      child = {
        segment,
        fullPath,
        field: isLast ? field : null,
        children: [],
        depth: i + 1,
        rowspan: 0,
      };
      current.children.push(child);
    } else if (isLast) {
      // 기존 중간 노드에 필드 정보 추가
      child.field = field;
    }

    current = child;
  }
}

/**
 * 배열 wildcard [*] 노드를 부모와 병합
 * photos.[*]._id → photos._id로 변환
 */
function mergeArrayWildcards(node: FieldTreeNode): void {
  // 자식 노드들을 먼저 재귀적으로 처리
  for (const child of node.children) {
    mergeArrayWildcards(child);
  }

  // [*] 자식 노드들을 찾아서 병합
  const wildcardChildren = node.children.filter((c) => c.segment === '[*]');
  const nonWildcardChildren = node.children.filter((c) => c.segment !== '[*]');

  for (const wildcard of wildcardChildren) {
    // [*] 노드의 자식들을 현재 노드의 자식으로 이동
    for (const grandChild of wildcard.children) {
      // 중복 체크
      const existing = nonWildcardChildren.find((c) => c.segment === grandChild.segment);
      if (!existing) {
        nonWildcardChildren.push(grandChild);
      }
    }

    // [*] 노드 자체가 field를 가지고 있으면 부모에 병합
    // (배열 자체의 정보는 부모가 이미 가지고 있으므로 무시)
  }

  // 자식 목록 업데이트
  node.children = nonWildcardChildren;
}

/**
 * 트리의 모든 노드 depth 재계산
 */
function recalculateDepths(node: FieldTreeNode, currentDepth: number): void {
  node.depth = currentDepth;
  for (const child of node.children) {
    recalculateDepths(child, currentDepth + 1);
  }
}

/**
 * rowspan 계산 (후위 순회)
 * - leaf 노드: rowspan = 1
 * - 중간 노드 (field가 있으면): rowspan = 1 + sum(children.rowspan)
 * - 중간 노드 (field가 없으면): rowspan = sum(children.rowspan)
 */
function calculateRowspan(node: FieldTreeNode): number {
  if (node.children.length === 0) {
    // leaf 노드
    node.rowspan = 1;
    return node.rowspan;
  }

  // 자식들의 rowspan 합계
  const childrenRowspan = node.children.reduce((sum, child) => sum + calculateRowspan(child), 0);

  // 자신이 필드를 가지고 있으면 +1 (자신도 행을 차지함)
  // 루트 노드는 제외
  if (node.field !== null) {
    node.rowspan = 1 + childrenRowspan;
  } else {
    node.rowspan = childrenRowspan;
  }

  return node.rowspan;
}

/**
 * 평탄화된 필드 배열을 트리로 변환
 * 루트 노드를 반환하며, 실제 필드들은 children에 포함
 */
export function buildFieldTree(fields: FieldSchema[]): FieldTreeNode {
  // 루트 노드 생성
  const root: FieldTreeNode = {
    segment: '',
    fullPath: '',
    field: null,
    children: [],
    depth: 0,
    rowspan: 0,
  };

  // 경로를 기준으로 정렬 (부모가 자식보다 먼저 오도록)
  const sortedFields = [...fields].sort((a, b) => a.path.localeCompare(b.path));

  // 각 필드를 트리에 삽입
  for (const field of sortedFields) {
    insertField(root, field);
  }

  // 배열 wildcard [*] 노드를 부모와 병합
  mergeArrayWildcards(root);

  // depth 재계산
  recalculateDepths(root, 0);

  // rowspan 계산
  calculateRowspan(root);

  return root;
}

/**
 * 트리를 평탄화하여 렌더링 순서대로 노드 반환
 * DFS 순회로 부모 -> 자식 순서 유지
 */
export function flattenTree(root: FieldTreeNode): FieldTreeNode[] {
  const result: FieldTreeNode[] = [];

  function traverse(node: FieldTreeNode): void {
    // 루트 노드는 제외
    if (node.fullPath !== '') {
      result.push(node);
    }

    // 자식 노드들을 세그먼트 순서대로 정렬하여 순회
    const sortedChildren = [...node.children].sort((a, b) => a.segment.localeCompare(b.segment));
    for (const child of sortedChildren) {
      traverse(child);
    }
  }

  traverse(root);
  return result;
}
