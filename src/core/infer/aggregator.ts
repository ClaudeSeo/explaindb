import type { BsonType } from '../../types/bson';
import type { FieldSchema, PathValue, RedactedExample } from '../../types/schema';
import { mask } from '../redact/masker';
import { detectPII, hasPII } from '../redact/detector';
import { calculateStats } from './stats';
import { getTypeDistribution, calculateTypeRatio, hasMixedTypes, isNumericType } from './analyzer';

export interface AggregateOptions {
  totalDocs: number;
  optionalThreshold: number;
  examplesPerType: number;
  redact: 'all' | 'pii' | 'off';
  redactMode: 'strict' | 'balanced';
  piiPatterns?: string[]; // 커스텀 PII 패턴 (예: ["kakao.*", "social.*"])
}

const DEFAULT_OPTIONS: AggregateOptions = {
  totalDocs: 100,
  optionalThreshold: 0.95,
  examplesPerType: 3,
  redact: 'pii',
  redactMode: 'balanced',
};

/**
 * 값을 문자열로 포맷팅 (배열/객체 처리)
 */
function formatValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';

  if (Array.isArray(value)) {
    return `[Array(${value.length})]`;
  }

  if (typeof value === 'object' && value !== null) {
    // Date 처리
    if (value instanceof Date) {
      return value.toISOString();
    }

    // ObjectId 처리 (MongoDB BSON ObjectId)
    const obj = value as Record<string, unknown>;
    if ('_bsontype' in obj && obj._bsontype === 'ObjectId') {
      return String(obj);
    }
    // buffer 형태의 ObjectId 처리
    if ('buffer' in obj && obj.buffer instanceof Uint8Array) {
      const hex = Array.from(obj.buffer)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      return hex;
    }

    const keys = Object.keys(value);
    if (keys.length === 0) return '{}';
    if (keys.length <= 3) return `{${keys.join(', ')}}`;
    return `{${keys.slice(0, 3).join(', ')}...}`;
  }

  return String(value);
}

/**
 * path의 예시 값 수집
 */
function collectExamples(
  values: PathValue[],
  path: string,
  options: AggregateOptions
): RedactedExample[] {
  const examples: RedactedExample[] = [];
  const seenValues = new Set<string>();

  // 타입별로 그룹화
  const byType = new Map<BsonType, PathValue[]>();
  for (const pv of values) {
    const existing = byType.get(pv.type) || [];
    existing.push(pv);
    byType.set(pv.type, existing);
  }

  // 타입별로 예시 수집
  for (const [, typeValues] of byType) {
    let collected = 0;
    for (const pv of typeValues) {
      if (collected >= options.examplesPerType) break;

      const example =
        options.redact === 'all'
          ? mask(pv.value, path, { mode: options.redactMode })
          : options.redact === 'pii' && hasPII(pv.value, path, options.piiPatterns)
          ? mask(pv.value, path, { mode: options.redactMode })
          : {
              value: formatValue(pv.value),
              type: pv.type,
              hints: detectPII(path, pv.value, options.piiPatterns),
            };

      // 중복 값 건너뛰기
      const key = `${example.type}:${example.value}`;
      if (seenValues.has(key)) continue;

      seenValues.add(key);
      examples.push(example);
      collected++;
    }
  }

  return examples;
}

/**
 * path 값들을 필드 스키마로 집계
 */
export function aggregatePath(
  path: string,
  values: PathValue[],
  options: Partial<AggregateOptions> = {}
): FieldSchema {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // 존재 여부 계산
  const presentDocs = new Set(values.map((v) => v.docIndex)).size;
  const presentRatio = presentDocs / opts.totalDocs;
  const absentCount = opts.totalDocs - presentDocs;

  // 타입 분포 계산
  const typeCounts = getTypeDistribution(values);
  const typeRatio = calculateTypeRatio(typeCounts, values.length);

  // 혼합 타입 확인
  const mixedType = hasMixedTypes(typeCounts);

  // optional 여부 판단
  const optional = presentRatio < opts.optionalThreshold;

  // 예시 수집
  const examples = collectExamples(values, path, opts);

  // 숫자형 필드의 통계 계산
  let stats = null;
  const numericValues = values.filter((v) => isNumericType(v.type));
  if (numericValues.length > 0) {
    const numbers = numericValues.map((v) => Number(v.value)).filter((n) => !isNaN(n));
    if (numbers.length > 0) {
      stats = calculateStats(numbers);
    }
  }

  // 예시에서 hint 수집
  const hints = [...new Set(examples.flatMap((e) => e.hints))];

  return {
    path,
    presentRatio,
    presentCount: presentDocs,
    absentCount,
    typeRatio,
    typeCounts: Object.fromEntries(typeCounts),
    examples,
    stats,
    optional,
    mixedType,
    hints,
  };
}

/**
 * 모든 path를 필드 스키마로 집계
 */
export function aggregateAll(
  paths: Map<string, PathValue[]>,
  options: Partial<AggregateOptions> = {}
): FieldSchema[] {
  const schemas: FieldSchema[] = [];

  for (const [path, values] of paths) {
    // 배열 메타데이터 path만 건너뛰기 (예: agreements.[*])
    // 배열 하위 필드는 포함 (예: agreements.[*]._id)
    if (path.endsWith('.[*]')) continue;
    // truncation 마커 건너뛰기
    if (path.endsWith('.[TRUNCATED]')) continue;

    const schema = aggregatePath(path, values, options);
    schemas.push(schema);
  }

  // 결정적인 출력을 위해 path로 정렬
  return schemas.sort((a, b) =>
    a.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: 'base' })
  );
}
