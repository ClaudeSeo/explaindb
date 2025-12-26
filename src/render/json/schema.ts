import { readFile } from 'fs/promises';
import type { CollectionSchema, RunMeta, SchemaOutput } from '../../types/schema';
import { deepSortKeys } from '../../utils/sort';

/**
 * schema.json 콘텐츠 렌더링
 */
export function renderSchemaJson(collections: CollectionSchema[], meta: RunMeta): SchemaOutput {
  const collectionsMap: Record<string, CollectionSchema> = {};

  for (const col of collections) {
    collectionsMap[col.name] = col;
  }

  const output: SchemaOutput = {
    meta,
    collections: collectionsMap,
  };

  // 결정적 출력을 위한 깊은 정렬
  return deepSortKeys(output) as SchemaOutput;
}

/**
 * Schema JSON 포맷팅하여 문자열화
 */
export function stringifySchemaJson(output: SchemaOutput): string {
  return JSON.stringify(output, null, 2);
}

/**
 * 기존 schema.json 파일 로드
 * 파일이 없거나 파싱 실패 시 null 반환
 */
export async function loadSchemaJson(filePath: string): Promise<SchemaOutput | null> {
  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content) as SchemaOutput;
  } catch {
    return null;
  }
}
