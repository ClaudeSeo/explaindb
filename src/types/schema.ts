import type { BsonType } from './bson';

/**
 * MongoDB 인덱스 정보
 */
export interface IndexInfo {
  name: string;
  key: Record<string, number>;
  unique: boolean;
  sparse?: boolean;
  expireAfterSeconds?: number;
}

/**
 * 스캐너로부터 가져온 컬렉션 메타데이터
 */
export interface CollectionMeta {
  name: string;
  estimatedCount: number;
  indexes: IndexInfo[];
  fingerprint: string;
}

/**
 * MongoDB 어댑터 스캔 결과
 */
export interface ScanResult {
  collections: CollectionMeta[];
  scanTime: number;
}

/**
 * MongoDB 어댑터 샘플링 결과
 */
export interface SampleResult {
  documents: Record<string, unknown>[];
  actualSize: number;
  strategy: 'random' | 'time-window' | 'filtered';
  fallback: boolean;
}

/**
 * Flatten 작업 절삭 카운터
 */
export interface TruncationCounters {
  depthTruncated: number;
  keysTruncated: number;
  arraysTruncated: number;
}

/**
 * Flatten으로부터 추출된 경로 값
 */
export interface PathValue {
  value: unknown;
  type: BsonType;
  docIndex: number;
}

/**
 * Flatten 결과
 */
export interface FlattenResult {
  paths: Map<string, PathValue[]>;
  truncationCounters: TruncationCounters;
}

/**
 * 민감정보가 제거된 예제 값
 */
export interface RedactedExample {
  value: string;
  type: BsonType;
  hints: string[];
}

/**
 * 필드 통계 (숫자 필드용)
 */
export interface FieldStats {
  min: number;
  max: number;
  avg: number;
}

/**
 * 추론 이후 필드 스키마
 */
export interface FieldSchema {
  path: string;
  presentRatio: number;
  presentCount: number;
  absentCount: number;
  typeRatio: Partial<Record<BsonType, number>>;
  typeCounts: Partial<Record<BsonType, number>>;
  examples: RedactedExample[];
  stats: FieldStats | null;
  optional: boolean;
  mixedType: boolean;
  hints: string[];
  description?: string;
}

/**
 * 주 변형과 비교한 변형 차이
 */
export interface VariantDiff {
  addedPaths: string[];
  missingPaths: string[];
}

/**
 * 스키마 변형
 */
export interface Variant {
  signature: string;
  count: number;
  ratio: number;
  paths: string[];
  diff: VariantDiff;
}

/**
 * 컬렉션 스키마 (완전체)
 */
export interface CollectionSchema {
  name: string;
  estimatedCount: number;
  sampledCount: number;
  indexes: IndexInfo[];
  fields: FieldSchema[];
  variants: Variant[];
  warnings: string[];
  summary?: string;
}

/**
 * 실행 메타데이터
 */
export interface RunMeta {
  generatedAt: string;
  database: string;
  sampling: {
    strategy: string;
    size: number;
    timeField?: string;
    timeWindowDays?: number;
    match?: string;
  };
  options: {
    maxDepth: number;
    redact: string;
    llm: string;
  };
  truncationCounters: TruncationCounters;
}

/**
 * 완전한 스키마 출력
 */
export interface SchemaOutput {
  meta: RunMeta;
  collections: Record<string, CollectionSchema>;
}
