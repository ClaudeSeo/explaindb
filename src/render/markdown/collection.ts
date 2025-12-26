import type { CollectionSchema, FieldSchema, IndexInfo, Variant } from '../../types/schema';
import { formatTableCell } from './utils';
import { renderFieldsHtmlTable } from '../html';

// 렌더링 표시 제한 상수
const MAX_DIFF_ITEMS_DISPLAY = 3;

/**
 * 필드 테이블 렌더링
 */
function renderFieldsTable(fields: FieldSchema[]): string[] {
  const lines: string[] = [];

  lines.push('## Fields');
  lines.push('');
  lines.push(...renderFieldsHtmlTable(fields));
  lines.push('');

  return lines;
}

/**
 * 인덱스 테이블 렌더링
 */
function renderIndexesTable(indexes: IndexInfo[]): string[] {
  const lines: string[] = [];

  if (indexes.length === 0) return lines;

  lines.push('## Indexes');
  lines.push('');
  lines.push('| Name | Keys | Unique | Sparse | TTL |');
  lines.push('|------|------|--------|--------|-----|');

  for (const idx of indexes) {
    const keys = Object.entries(idx.key)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    const unique = idx.unique ? 'Yes' : 'No';
    const sparse = idx.sparse ? 'Yes' : 'No';
    const ttl = idx.expireAfterSeconds !== undefined ? `${idx.expireAfterSeconds}s` : '-';

    lines.push(`| ${idx.name} | ${keys} | ${unique} | ${sparse} | ${ttl} |`);
  }
  lines.push('');

  return lines;
}

/**
 * 변형 테이블 렌더링
 */
function renderVariantsTable(variants: Variant[]): string[] {
  const lines: string[] = [];

  if (variants.length === 0) return lines;

  lines.push('## Variants');
  lines.push('');
  lines.push('| Variant | Ratio | Diff from Primary |');
  lines.push('|---------|-------|-------------------|');

  for (let i = 0; i < variants.length; i++) {
    const v = variants[i];
    const label = i === 0 ? `#${i + 1} (primary)` : `#${i + 1}`;
    const ratio = `${Math.round(v.ratio * 100)}%`;

    let diff = '-';
    if (i > 0 && (v.diff.addedPaths.length > 0 || v.diff.missingPaths.length > 0)) {
      const parts: string[] = [];
      if (v.diff.addedPaths.length > 0) {
        const truncated = v.diff.addedPaths.length > MAX_DIFF_ITEMS_DISPLAY;
        parts.push(`+${v.diff.addedPaths.slice(0, MAX_DIFF_ITEMS_DISPLAY).join(', ')}${truncated ? '...' : ''}`);
      }
      if (v.diff.missingPaths.length > 0) {
        const truncated = v.diff.missingPaths.length > MAX_DIFF_ITEMS_DISPLAY;
        parts.push(`-${v.diff.missingPaths.slice(0, MAX_DIFF_ITEMS_DISPLAY).join(', ')}${truncated ? '...' : ''}`);
      }
      diff = formatTableCell(parts.join(', '));
    }

    lines.push(`| ${label} | ${ratio} | ${diff} |`);
  }
  lines.push('');

  return lines;
}

/**
 * 컬렉션 Markdown 렌더링
 */
export function renderCollection(schema: CollectionSchema): string {
  const lines: string[] = [];

  // 헤더
  lines.push(`# Collection: ${schema.name}`);
  lines.push('');
  lines.push(`- Estimated Documents: ~${schema.estimatedCount.toLocaleString()}`);
  lines.push(`- Sampled: ${schema.sampledCount}`);
  lines.push(`- Indexes: ${schema.indexes.length}`);
  lines.push(`- Variants: ${schema.variants.length}`);
  lines.push(`- Fields: ${schema.fields.length}`);
  lines.push('');

  // 요약 (있는 경우)
  if (schema.summary) {
    lines.push('## Summary');
    lines.push('');
    lines.push(schema.summary);
    lines.push('');
  }

  // 경고
  if (schema.warnings.length > 0) {
    lines.push('## Warnings');
    lines.push('');
    for (const warning of schema.warnings) {
      lines.push(`- ⚠️ ${warning}`);
    }
    lines.push('');
  }

  // 필드
  lines.push(...renderFieldsTable(schema.fields));

  // 인덱스
  lines.push(...renderIndexesTable(schema.indexes));

  // 변형
  lines.push(...renderVariantsTable(schema.variants));

  return lines.join('\n');
}
