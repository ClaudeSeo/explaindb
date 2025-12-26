import type { Collection, Document } from 'mongodb';
import type { SampleResult } from '../../types/schema';
import { logger } from '../../cli/logger';

// 시간 계산 상수
const MS_PER_DAY = 24 * 60 * 60 * 1_000;

export interface SampleOptions {
  size: number;
  timeField?: string;
  timeWindowDays?: number;
  match?: Record<string, unknown>;
  strict?: boolean;
}

const DEFAULT_OPTIONS: SampleOptions = {
  size: 100,
  strict: false,
};

/**
 * 시간 윈도우 매치 스테이지 생성
 */
function buildTimeWindowMatch(timeField: string, days: number): Record<string, unknown> {
  const now = new Date();
  const pastDate = new Date(now.getTime() - days * MS_PER_DAY);

  return {
    [timeField]: { $gte: pastDate },
  };
}

/**
 * 컬렉션에서 문서 샘플링
 */
export async function sample(
  collection: Collection<Document>,
  options: Partial<SampleOptions> = {}
): Promise<SampleResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const pipeline: Document[] = [];
  let strategy: SampleResult['strategy'] = 'random';
  let fallback = false;

  const matchConditions: Record<string, unknown>[] = [];

  if (opts.timeField && opts.timeWindowDays) {
    matchConditions.push(buildTimeWindowMatch(opts.timeField, opts.timeWindowDays));
    strategy = 'time-window';
  }

  if (opts.match) {
    matchConditions.push(opts.match);
    strategy = 'filtered';
  }

  if (matchConditions.length > 0) {
    pipeline.push({ $match: { $and: matchConditions } });
  }

  pipeline.push({ $sample: { size: opts.size } });

  logger.debug(`Sampling with pipeline: ${JSON.stringify(pipeline)}`);

  try {
    const documents = await collection.aggregate(pipeline).toArray();

    if (documents.length === 0 && matchConditions.length > 0 && !opts.strict) {
      logger.warn(`No documents matched filters, falling back to random sampling`);
      const fallbackPipeline = [{ $sample: { size: opts.size } }];
      const fallbackDocs = await collection.aggregate(fallbackPipeline).toArray();
      fallback = true;

      return {
        documents: fallbackDocs as Record<string, unknown>[],
        actualSize: fallbackDocs.length,
        strategy: 'random',
        fallback: true,
      };
    }

    if (documents.length === 0 && opts.strict) {
      throw new Error(`No documents found matching the specified filters`);
    }

    return {
      documents: documents as Record<string, unknown>[],
      actualSize: documents.length,
      strategy,
      fallback,
    };
  } catch (error) {
    if (opts.strict) {
      throw error;
    }

    logger.warn(`Sampling failed: ${(error as Error).message}, falling back to random`);

    const fallbackPipeline = [{ $sample: { size: opts.size } }];
    const fallbackDocs = await collection.aggregate(fallbackPipeline).toArray();

    return {
      documents: fallbackDocs as Record<string, unknown>[],
      actualSize: fallbackDocs.length,
      strategy: 'random',
      fallback: true,
    };
  }
}
