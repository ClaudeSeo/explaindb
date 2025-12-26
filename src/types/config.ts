import { z } from 'zod/v4';

/**
 * Zod를 사용한 CLI 옵션 스키마 검증
 */
export const CLIOptionsSchema = z.object({
  // 연결
  uri: z.string().optional(),
  db: z.string().optional(),

  // 출력
  out: z.string().default('./out'),

  // 컬렉션 필터링
  include: z.string().optional(),
  exclude: z.string().optional(),

  // 샘플링
  sampleSize: z.number().int().positive().default(100),
  timeField: z.string().optional(),
  timeWindowDays: z.number().int().positive().optional(),
  match: z.string().optional(),
  samplingStrict: z.boolean().default(false),

  // Flatten 제한
  maxDepth: z.number().int().positive().default(20),
  maxKeysPerDoc: z.number().int().positive().default(2000),
  maxArraySample: z.number().int().positive().default(50),

  // 추론
  optionalThreshold: z.number().min(0).max(1).default(0.95),
  examplesPerType: z.number().int().positive().default(3),
  variantTop: z.number().int().positive().default(10),

  // 민감정보 제거
  redact: z.enum(['all', 'pii', 'off']).default('pii'),
  redactMode: z.enum(['strict', 'balanced']).default('balanced'),
  piiPatterns: z.array(z.string()).optional(), // 커스텀 PII 패턴 (예: ["kakao.*", "social.*"])

  // LLM
  llm: z.enum(['on', 'off']).default('off'),
  llmProvider: z.string().default('bedrock'),
  llmModel: z.string().optional(),
  llmRegion: z.string().optional(),
  llmCache: z.enum(['on', 'off']).default('on'),
  llmMaxFields: z.number().int().positive().optional(),

  // 동시성
  concurrency: z.number().int().positive().default(10),

  // 증분 처리
  incremental: z.enum(['on', 'off']).default('on'),
  force: z.boolean().default(false),
  pruneRemovedCollections: z.enum(['on', 'off']).default('on'),

  // 로깅
  verbose: z.boolean().default(false),
});

export type CLIOptions = z.infer<typeof CLIOptionsSchema>;

/**
 * 검증되고 해석된 설정
 */
export interface ResolvedConfig extends CLIOptions {
  uri: string;
  db: string;
}

/**
 * 환경 변수 이름
 */
export const ENV_VARS = {
  URI: 'EXPLAINDB_URI',
  DB: 'EXPLAINDB_DB',
  LLM_API_KEY: 'EXPLAINDB_LLM_API_KEY',
} as const;
