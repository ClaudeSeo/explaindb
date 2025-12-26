import type { SchemaOutput } from '../../types/schema';

/**
 * 기존 schema.json에서 추출한 설명 정보
 */
export interface ExistingDescriptions {
  collections: Map<
    string,
    {
      summary?: string;
      fields: Map<string, string>; // path -> description
    }
  >;
}

/**
 * SchemaOutput에서 기존 설명을 추출하여 재사용 가능한 형태로 변환
 *
 * @param schema - 기존 schema.json 데이터
 * @returns 컬렉션별 summary와 필드별 description 맵
 *
 * @example
 * ```ts
 * const schema = JSON.parse(fs.readFileSync('schema.json', 'utf-8'));
 * const existing = extractDescriptions(schema);
 *
 * const userDesc = existing.collections.get('users');
 * const nameDesc = userDesc?.fields.get('name'); // "사용자 이름"
 * ```
 */
export function extractDescriptions(
  schema: SchemaOutput,
): ExistingDescriptions {
  const collections = new Map<
    string,
    {
      summary?: string;
      fields: Map<string, string>;
    }
  >();

  // 각 컬렉션 순회
  for (const [collectionName, collectionSchema] of Object.entries(
    schema.collections,
  )) {
    const fields = new Map<string, string>();

    // 필드별 description 추출
    for (const field of collectionSchema.fields) {
      if (field.description) {
        fields.set(field.path, field.description);
      }
    }

    // 컬렉션 정보 저장
    collections.set(collectionName, {
      summary: collectionSchema.summary,
      fields,
    });
  }

  return { collections };
}
