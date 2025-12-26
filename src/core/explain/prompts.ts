import type { CollectionSummaryInput, FieldDescriptionInput } from '../../adapters/llm/provider';

// 구조화된 응답 타입 (provider에서 import하지 않고 여기서 정의)
export interface CollectionSummaryResponse {
  purpose: string;
  structure: string;
  notes: string | null;
}

export interface FieldDescriptionsResponse {
  descriptions: Array<{ path: string; description: string }>;
}

// 프롬프트 빌더 함수
export function buildCollectionSummaryPrompt(input: CollectionSummaryInput): string {
  return `당신은 MongoDB 컬렉션 스키마 분석 전문가입니다.

다음 컬렉션 정보를 분석하고 JSON 형식으로 응답하세요:

컬렉션명: ${input.collectionName}
필드 수: ${input.fieldCount}
샘플 수: ${input.sampleCount}
주요 필드: ${input.fieldPaths.slice(0, 20).join(', ')}

응답 형식 (JSON만 출력):
{
  "purpose": "컬렉션의 목적 (1문장)",
  "structure": "주요 데이터 구조 (1문장)",
  "notes": "특이사항/주의점 (1문장, 없으면 null)"
}

규칙:
- 한국어로 작성
- 간결체 사용 (~이다, ~한다)
- **볼드** 마크다운 금지
- # 헤딩 금지
- JSON만 출력 (다른 텍스트 금지)`;
}

export function buildFieldDescriptionsPrompt(inputs: FieldDescriptionInput[]): string {
  const fieldsInfo = inputs.map(input => {
    const typeRatioStr = Object.entries(input.typeRatio)
      .map(([type, ratio]) => `${type}(${Math.round(ratio * 100)}%)`)
      .join(', ');
    const examplesStr = input.examples.slice(0, 3).join(', ');
    const foreignKeyStr = input.foreignKeyContext?.length
      ? `\n외래키 컨텍스트: ${input.foreignKeyContext.join(', ')}`
      : '';

    return `필드: ${input.path}
타입: ${typeRatioStr}
존재율: ${Math.round(input.presentRatio * 100)}%
예시: ${examplesStr}${foreignKeyStr}`;
  }).join('\n\n');

  return `당신은 MongoDB 필드 분석 전문가입니다.

다음 필드들을 분석하고 JSON 형식으로 응답하세요:

${fieldsInfo}

응답 형식 (JSON만 출력):
{
  "descriptions": [
    { "path": "필드경로", "description": "간결한 설명" }
  ]
}

규칙:
- 한국어로 작성
- 간결체 (~이다)
- "무엇이다" 형식만 사용 (예: "채팅방 UUID", "생성 일시")
- **볼드** 마크다운 금지
- JSON만 출력`;
}

// JSON 파싱 헬퍼
export function parseCollectionSummaryResponse(text: string): CollectionSummaryResponse | null {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

export function parseFieldDescriptionsResponse(text: string): FieldDescriptionsResponse | null {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

// 기존 fillTemplate 함수는 유지 (호환성)
export function fillTemplate(template: string, values: Record<string, string | number>): string {
  let result = template;
  for (const [key, value] of Object.entries(values)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
  }
  return result;
}
