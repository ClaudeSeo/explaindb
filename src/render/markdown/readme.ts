import type { CollectionSchema, RunMeta } from '../../types/schema';
import { stableSort } from '../../utils/sort';
import { escapeTableCell } from './utils';

/**
 * README.md 콘텐츠 렌더링
 */
export function renderReadme(collections: CollectionSchema[], meta: RunMeta): string {
  const lines: string[] = [];

  // 헤더
  lines.push('# Schema Documentation');
  lines.push('');
  lines.push(`Generated: ${meta.generatedAt}`);
  lines.push(`Database: ${meta.database}`);
  lines.push(`Collections: ${collections.length}`);
  lines.push('');

  // 샘플링 옵션
  lines.push('## Sampling Options');
  lines.push('');
  lines.push(`- Strategy: ${meta.sampling.strategy}`);
  lines.push(`- Sample Size: ${meta.sampling.size}`);
  if (meta.sampling.timeField) {
    lines.push(`- Time Field: ${meta.sampling.timeField}`);
  }
  if (meta.sampling.timeWindowDays) {
    lines.push(`- Time Window: ${meta.sampling.timeWindowDays} days`);
  }
  if (meta.sampling.match) {
    lines.push(`- Match Filter: ${meta.sampling.match}`);
  }
  lines.push(`- Redaction: ${meta.options.redact}`);
  lines.push(`- Max Depth: ${meta.options.maxDepth}`);
  lines.push('');

  // 잘림 경고
  const { truncationCounters } = meta;
  if (
    truncationCounters.depthTruncated > 0 ||
    truncationCounters.keysTruncated > 0 ||
    truncationCounters.arraysTruncated > 0
  ) {
    lines.push('## Truncation Warnings');
    lines.push('');
    if (truncationCounters.depthTruncated > 0) {
      lines.push(`- ⚠️ Depth truncated: ${truncationCounters.depthTruncated} paths exceeded max depth`);
    }
    if (truncationCounters.keysTruncated > 0) {
      lines.push(`- ⚠️ Keys truncated: ${truncationCounters.keysTruncated} keys exceeded per-doc limit`);
    }
    if (truncationCounters.arraysTruncated > 0) {
      lines.push(`- ⚠️ Arrays truncated: ${truncationCounters.arraysTruncated} arrays exceeded sample limit`);
    }
    lines.push('');
  }

  // 컬렉션 테이블
  lines.push('## Collections');
  lines.push('');
  lines.push('| Collection | Documents | Fields | Variants | Warnings |');
  lines.push('|------------|-----------|--------|----------|----------|');

  const sortedCollections = stableSort(collections, (c) => c.name);

  for (const col of sortedCollections) {
    const warnings = col.warnings.length > 0 ? escapeTableCell(col.warnings.join(', ')) : '-';
    const docCount = col.estimatedCount >= 1000
      ? `~${Math.round(col.estimatedCount / 1000)}K`
      : `~${col.estimatedCount}`;

    lines.push(
      `| [${col.name}](./collections/${col.name}.md) | ${docCount} | ${col.fields.length} | ${col.variants.length} | ${warnings} |`
    );
  }
  lines.push('');

  // 전역 경고
  const collectionsWithPII = collections.filter((c) =>
    c.fields.some((f) => f.hints.length > 0)
  );

  if (collectionsWithPII.length > 0) {
    lines.push('## Warnings');
    lines.push('');
    for (const col of collectionsWithPII) {
      const piiFields = col.fields
        .filter((f) => f.hints.length > 0)
        .map((f) => f.path);
      if (piiFields.length > 0) {
        lines.push(`- **[${col.name}]** PII-suspected fields detected: ${escapeTableCell(piiFields.join(', '))}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}
