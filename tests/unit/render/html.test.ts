import { test, expect, describe } from 'bun:test';
import { buildFieldTree, flattenTree } from '../../../src/render/html/tree';
import { renderFieldsHtmlTable } from '../../../src/render/html/collection';
import { escapeHtml } from '../../../src/render/html/utils';
import type { FieldSchema } from '../../../src/types/schema';
import { BsonType } from '../../../src/types/bson';

/**
 * 테스트용 필드 스키마 생성 헬퍼
 */
function createFieldSchema(path: string, overrides: Partial<FieldSchema> = {}): FieldSchema {
  return {
    path,
    presentRatio: 1,
    presentCount: 100,
    absentCount: 0,
    typeRatio: { [BsonType.String]: 1 },
    typeCounts: { [BsonType.String]: 100 },
    examples: [],
    stats: null,
    optional: false,
    mixedType: false,
    hints: [],
    ...overrides,
  };
}

describe('escapeHtml', () => {
  test('should escape < and >', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
  });

  test('should escape &', () => {
    expect(escapeHtml('foo & bar')).toBe('foo &amp; bar');
  });

  test('should escape quotes', () => {
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
  });

  test('should handle empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  test('should not escape normal text', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });
});

describe('buildFieldTree', () => {
  test('should build tree from flat paths', () => {
    const fields = [
      createFieldSchema('name'),
      createFieldSchema('address'),
      createFieldSchema('address.city'),
      createFieldSchema('address.zip'),
    ];

    const tree = buildFieldTree(fields);

    expect(tree.segment).toBe('');
    expect(tree.children.length).toBe(2);

    // address 노드 확인
    const addressNode = tree.children.find((c) => c.segment === 'address');
    expect(addressNode).toBeDefined();
    expect(addressNode?.children.length).toBe(2);
    expect(addressNode?.children.map((c) => c.segment).sort()).toEqual(['city', 'zip']);
  });

  test('should handle array wildcard [*] by merging with parent', () => {
    const fields = [
      createFieldSchema('items', { typeRatio: { [BsonType.Array]: 1 } }),
      createFieldSchema('items.[*]', { typeRatio: { [BsonType.Object]: 1 } }),
      createFieldSchema('items.[*].name'),
      createFieldSchema('items.[*].price', { typeRatio: { [BsonType.Int]: 1 } }),
    ];

    const tree = buildFieldTree(fields);
    const itemsNode = tree.children.find((c) => c.segment === 'items');

    expect(itemsNode).toBeDefined();
    // [*] 노드가 부모와 병합되어 items가 직접 name, price를 자식으로 가짐
    expect(itemsNode?.children.length).toBe(2);
    expect(itemsNode?.children.map((c) => c.segment).sort()).toEqual(['name', 'price']);
  });

  test('should handle deep nesting (a.b.c.d.e)', () => {
    const fields = [
      createFieldSchema('a'),
      createFieldSchema('a.b'),
      createFieldSchema('a.b.c'),
      createFieldSchema('a.b.c.d'),
      createFieldSchema('a.b.c.d.e'),
    ];

    const tree = buildFieldTree(fields);
    const flatNodes = flattenTree(tree);

    expect(flatNodes.length).toBe(5);
    expect(flatNodes.map((n) => n.fullPath)).toEqual(['a', 'a.b', 'a.b.c', 'a.b.c.d', 'a.b.c.d.e']);
    expect(flatNodes.map((n) => n.depth)).toEqual([1, 2, 3, 4, 5]);
  });

  test('should calculate correct rowspan for leaf nodes', () => {
    const fields = [createFieldSchema('name'), createFieldSchema('email')];

    const tree = buildFieldTree(fields);

    // leaf 노드는 rowspan = 1
    expect(tree.children[0]?.rowspan).toBe(1);
    expect(tree.children[1]?.rowspan).toBe(1);
  });

  test('should calculate correct rowspan for parent nodes', () => {
    const fields = [
      createFieldSchema('address', { typeRatio: { [BsonType.Object]: 1 } }),
      createFieldSchema('address.city'),
      createFieldSchema('address.zip'),
    ];

    const tree = buildFieldTree(fields);
    const addressNode = tree.children.find((c) => c.segment === 'address');

    // address 노드: 자신(1) + 자식들(2) = 3
    expect(addressNode?.rowspan).toBe(3);
    expect(addressNode?.children[0]?.rowspan).toBe(1);
    expect(addressNode?.children[1]?.rowspan).toBe(1);
  });

  test('should calculate rowspan for nested structure', () => {
    const fields = [
      createFieldSchema('a', { typeRatio: { [BsonType.Object]: 1 } }),
      createFieldSchema('a.b', { typeRatio: { [BsonType.Object]: 1 } }),
      createFieldSchema('a.b.c'),
      createFieldSchema('a.b.d'),
    ];

    const tree = buildFieldTree(fields);
    const aNode = tree.children.find((c) => c.segment === 'a');
    const bNode = aNode?.children.find((c) => c.segment === 'b');

    // b 노드: 자신(1) + 자식(2) = 3
    expect(bNode?.rowspan).toBe(3);
    // a 노드: 자신(1) + b의 rowspan(3) = 4
    expect(aNode?.rowspan).toBe(4);
  });
});

describe('flattenTree', () => {
  test('should return nodes in DFS order', () => {
    const fields = [
      createFieldSchema('a'),
      createFieldSchema('a.x'),
      createFieldSchema('b'),
      createFieldSchema('b.y'),
    ];

    const tree = buildFieldTree(fields);
    const flatNodes = flattenTree(tree);

    expect(flatNodes.map((n) => n.fullPath)).toEqual(['a', 'a.x', 'b', 'b.y']);
  });

  test('should exclude root node', () => {
    const fields = [createFieldSchema('name')];

    const tree = buildFieldTree(fields);
    const flatNodes = flattenTree(tree);

    expect(flatNodes.every((n) => n.fullPath !== '')).toBe(true);
  });
});

describe('renderFieldsHtmlTable', () => {
  test('should render valid HTML table structure', () => {
    const fields = [createFieldSchema('name')];

    const lines = renderFieldsHtmlTable(fields);
    const html = lines.join('\n');

    expect(html).toContain('<table>');
    expect(html).toContain('</table>');
    expect(html).toContain('<thead>');
    expect(html).toContain('</thead>');
    expect(html).toContain('<tbody>');
    expect(html).toContain('</tbody>');
  });

  test('should render table headers', () => {
    const fields = [createFieldSchema('name')];

    const lines = renderFieldsHtmlTable(fields);
    const html = lines.join('\n');

    // Path 헤더는 maxDepth에 따라 colspan이 적용됨
    expect(html).toMatch(/<th colspan="\d+">Path<\/th>/);
    expect(html).toContain('<th>Present%</th>');
    expect(html).toContain('<th>Types</th>');
    expect(html).toContain('<th>Optional</th>');
    expect(html).toContain('<th>Examples</th>');
    expect(html).toContain('<th>Description</th>');
    expect(html).toContain('<th>Notes</th>');
  });

  test('should render field data correctly', () => {
    const fields = [
      createFieldSchema('email', {
        presentRatio: 0.95,
        optional: true,
        examples: [{ value: 'test@example.com', type: BsonType.String, hints: [] }],
        description: '이메일 주소',
      }),
    ];

    const lines = renderFieldsHtmlTable(fields);
    const html = lines.join('\n');

    expect(html).toContain('email');
    expect(html).toContain('95%');
    expect(html).toContain('Yes'); // optional
    expect(html).toContain('이메일 주소');
  });

  test('should apply rowspan for nested fields', () => {
    const fields = [
      createFieldSchema('address', { typeRatio: { [BsonType.Object]: 1 } }),
      createFieldSchema('address.city'),
      createFieldSchema('address.zip'),
    ];

    const lines = renderFieldsHtmlTable(fields);
    const html = lines.join('\n');

    // address 노드에 rowspan="3" 적용 확인
    expect(html).toContain('rowspan="3"');
    expect(html).toContain('address');
    expect(html).toContain('city');
    expect(html).toContain('zip');
  });

  test('should use multi-column path structure for nested fields', () => {
    const fields = [
      createFieldSchema('parent', { typeRatio: { [BsonType.Object]: 1 } }),
      createFieldSchema('parent.child'),
    ];

    const lines = renderFieldsHtmlTable(fields);
    const html = lines.join('\n');

    // 다중 컬럼 구조: 부모에 rowspan, 자식은 별도 컬럼에 렌더링
    expect(html).toContain('rowspan="2"');
    expect(html).toContain('parent');
    expect(html).toContain('child');
    // Path 헤더에 colspan 적용 (maxDepth=2)
    expect(html).toContain('<th colspan="2">Path</th>');
  });

  test('should escape HTML in field values', () => {
    const fields = [
      createFieldSchema('data', {
        description: '<script>alert("xss")</script>',
      }),
    ];

    const lines = renderFieldsHtmlTable(fields);
    const html = lines.join('\n');

    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>alert');
  });

  test('should handle mixed types', () => {
    const fields = [
      createFieldSchema('value', {
        typeRatio: { [BsonType.String]: 0.6, [BsonType.Int]: 0.4 },
        mixedType: true,
      }),
    ];

    const lines = renderFieldsHtmlTable(fields);
    const html = lines.join('\n');

    expect(html).toContain('string(60%)');
    expect(html).toContain('int(40%)');
    expect(html).toContain('Mixed');
  });

  test('should handle PII hints', () => {
    const fields = [
      createFieldSchema('email', {
        hints: ['email'],
      }),
    ];

    const lines = renderFieldsHtmlTable(fields);
    const html = lines.join('\n');

    expect(html).toContain('PII: email');
  });

  test('should handle stats', () => {
    const fields = [
      createFieldSchema('age', {
        typeRatio: { [BsonType.Int]: 1 },
        stats: { min: 0, max: 100, avg: 30 },
      }),
    ];

    const lines = renderFieldsHtmlTable(fields);
    const html = lines.join('\n');

    expect(html).toContain('min: 0.00');
    expect(html).toContain('max: 100.00');
  });

  test('should handle empty fields array', () => {
    const fields: FieldSchema[] = [];

    const lines = renderFieldsHtmlTable(fields);
    const html = lines.join('\n');

    expect(html).toContain('<table>');
    expect(html).toContain('<tbody>');
    expect(html).toContain('</tbody>');
    expect(html).toContain('</table>');
  });
});
