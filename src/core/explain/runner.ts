import type { LLMProvider, CollectionSummaryInput, FieldDescriptionInput } from '../../adapters/llm/provider';
import { generateCacheKey, getCached, setCached } from './cache';
import { logger } from '../../cli/logger';

// 재시도 관련 상수
const RETRY_BASE_DELAY_MS = 1_000;
const BACKOFF_MULTIPLIER = 2;

export interface ExplainOptions {
  maxRetries: number;
  cacheEnabled: boolean;
}

const DEFAULT_OPTIONS: ExplainOptions = {
  maxRetries: 3,
  cacheEnabled: true,
};

/**
 * 재시도 및 캐싱을 통한 LLM 설명 실행
 */
export async function runExplain<T>(
  operation: () => Promise<T>,
  cacheKey: string,
  options: Partial<ExplainOptions> = {}
): Promise<T | null> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // 캐시 확인
  if (opts.cacheEnabled) {
    const cached = await getCached(cacheKey);
    if (cached) {
      logger.debug(`Cache hit: ${cacheKey}`);
      return JSON.parse(cached) as T;
    }
  }

  // 재시도와 함께 실행
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
    try {
      const result = await operation();

      // 결과 캐싱
      if (opts.cacheEnabled) {
        await setCached(cacheKey, JSON.stringify(result));
      }

      return result;
    } catch (error) {
      lastError = error as Error;
      logger.warn(`LLM call failed (attempt ${attempt}/${opts.maxRetries}): ${lastError.message}`);

      if (attempt < opts.maxRetries) {
        // 지수 백오프
        const delay = RETRY_BASE_DELAY_MS * (BACKOFF_MULTIPLIER ** attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  logger.error(`LLM call failed after ${opts.maxRetries} retries`);
  return null;
}

/**
 * 재시도와 함께 컬렉션 요약 생성
 */
export async function generateSummary(
  provider: LLMProvider,
  input: CollectionSummaryInput,
  options: Partial<ExplainOptions> = {}
): Promise<{ purpose: string; structure: string; notes: string | null } | null> {
  const cacheKey = generateCacheKey({ type: 'summary', ...input });

  const result = await runExplain(
    () => provider.generateCollectionSummary(input),
    cacheKey,
    options
  );

  return result || null;
}

/**
 * 재시도와 함께 필드 설명 생성
 */
export async function generateDescriptions(
  provider: LLMProvider,
  db: string,
  collectionName: string,
  inputs: FieldDescriptionInput[],
  options: Partial<ExplainOptions> = {}
): Promise<Map<string, string>> {
  const cacheKey = generateCacheKey({ type: 'descriptions', db, collectionName, inputs });

  const result = await runExplain(
    () => provider.generateFieldDescriptions(inputs),
    cacheKey,
    options
  );

  const descriptions = new Map<string, string>();
  if (result) {
    for (const desc of result) {
      descriptions.set(desc.path, desc.description);
    }
  }

  return descriptions;
}
