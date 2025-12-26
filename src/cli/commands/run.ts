import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import type { Db } from 'mongodb';
import type { ResolvedConfig } from '../../types/config';
import type { CollectionSchema, RunMeta, TruncationCounters } from '../../types/schema';
import { connect, disconnect } from '../../adapters/mongo/client';
import { scan } from '../../adapters/mongo/scanner';
import { sample } from '../../adapters/mongo/sampler';
import { flatten, mergeFlattenResults } from '../../core/flatten/flattener';
import { aggregateAll } from '../../core/infer/aggregator';
import { analyzeVariants } from '../../core/variants/signature';
import { renderReadme } from '../../render/markdown/readme';
import { renderCollection } from '../../render/markdown/collection';
import { renderSchemaJson, stringifySchemaJson, loadSchemaJson } from '../../render/json/schema';
import { logger } from '../logger';
import { createBedrockProvider } from '../../adapters/llm/bedrock';
import { generateSummary, generateDescriptions, type ExplainOptions } from '../../core/explain/runner';
import type { LLMProvider } from '../../adapters/llm/provider';
import type { FieldDescriptionInput } from '../../adapters/llm/provider';
import { runWithConcurrency } from '../../utils/concurrency';
import { extractDescriptions, type ExistingDescriptions } from '../../core/explain/incremental';

// 종료 코드
export const EXIT_CODES = {
  SUCCESS: 0,
  CONNECTION_FAILURE: 1,
  AUTH_FAILURE: 2,
  SAMPLING_FAILURE: 3,
  RENDER_FAILURE: 4,
  INVALID_ARGS: 10,
};

/**
 * Date 포맷 헬퍼 - 타임존 오프셋 포함
 */
function formatDateWithOffset(date: Date): string {
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const hours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0');
  const minutes = String(Math.abs(offset) % 60).padStart(2, '0');
  const iso = date.toISOString().slice(0, -1); // Z 제거
  return `${iso}${sign}${hours}:${minutes}`;
}

/**
 * Summary 조합 헬퍼
 */
function composeSummary(response: { purpose: string; structure: string; notes: string | null }): string {
  const parts = [response.purpose, response.structure];
  if (response.notes) {
    parts.push(response.notes);
  }
  return parts.join(' ');
}

/**
 * 출력 디렉토리 생성
 * 구조: {outDir}/{dbName}/collections/, {outDir}/{dbName}/artifacts/
 */
async function ensureOutputDirs(outDir: string, dbName: string): Promise<string> {
  const dbOutDir = join(outDir, dbName);
  await mkdir(dbOutDir, { recursive: true });
  await mkdir(join(dbOutDir, 'collections'), { recursive: true });
  await mkdir(join(dbOutDir, 'artifacts'), { recursive: true });
  return dbOutDir;
}

/**
 * 외래키 패턴 필드 수집
 * *Id, *_id, *Uuid 패턴 필드를 외래키로 인식
 */
function collectForeignKeyFields(schemas: CollectionSchema[]): Map<string, string[]> {
  const foreignKeyMap = new Map<string, string[]>();

  for (const schema of schemas) {
    for (const field of schema.fields) {
      const fieldName = field.path.split('.').pop() || field.path;
      // *Id, *_id, *Uuid 패턴 체크
      if (/(?:Id|_id|Uuid)$/i.test(fieldName)) {
        const key = `${schema.name}.${field.path}`;
        foreignKeyMap.set(key, []);
      }
    }
  }

  return foreignKeyMap;
}

/**
 * 필드의 외래키 컨텍스트 추론
 * 필드명이 다른 컬렉션의 외래키 필드와 매칭되는지 확인
 */
function inferForeignKeyContext(fieldPath: string, allForeignKeys: Map<string, string[]>): string[] {
  const context: string[] = [];
  const fieldName = fieldPath.split('.').pop() || fieldPath;

  // 필드명과 매칭되는 외래키 필드 찾기
  for (const [foreignKey] of allForeignKeys) {
    const parts = foreignKey.split('.');
    const fkPath = parts.slice(1).join('.');

    if (!fkPath) continue;

    const fkFieldName = fkPath.split('.').pop();
    if (!fkFieldName) continue;

    // 필드명이 유사한 경우 (예: userId와 users._id)
    if (
      fieldName.toLowerCase().includes(fkFieldName.toLowerCase()) ||
      fkFieldName.toLowerCase().includes(fieldName.toLowerCase())
    ) {
      context.push(foreignKey);
    }
  }

  return context;
}

/**
 * 단일 컬렉션 처리
 */
async function processCollection(
  db: Db,
  collectionName: string,
  config: ResolvedConfig,
  llmProvider?: LLMProvider,
  existingDescriptions?: ExistingDescriptions | null,
  explainOptions?: Partial<ExplainOptions>
): Promise<{ schema: CollectionSchema; truncation: TruncationCounters }> {
  const collection = db.collection(collectionName);

  // 문서 샘플링
  const sampleResult = await sample(collection, {
    size: config.sampleSize,
    timeField: config.timeField,
    timeWindowDays: config.timeWindowDays,
    match: config.match ? JSON.parse(config.match) : undefined,
    strict: config.samplingStrict,
  });

  logger.debug(`Sampled ${sampleResult.actualSize} documents (strategy: ${sampleResult.strategy})`);

  // 스캐너에서 컬렉션 정보 가져오기
  const scanResult = await scan(db, { include: collectionName, exclude: undefined });
  const collectionMeta = scanResult.collections.find((c) => c.name === collectionName);

  // 모든 문서 평탄화
  const flattenResults = sampleResult.documents.map((doc, idx) =>
    flatten(doc, idx, {
      maxDepth: config.maxDepth,
      maxKeysPerDoc: config.maxKeysPerDoc,
      maxArraySample: config.maxArraySample,
    })
  );

  const merged = mergeFlattenResults(flattenResults);

  // 필드 스키마로 집계
  const fields = aggregateAll(merged.paths, {
    totalDocs: sampleResult.actualSize,
    optionalThreshold: config.optionalThreshold,
    examplesPerType: config.examplesPerType,
    redact: config.redact,
    redactMode: config.redactMode,
    piiPatterns: config.piiPatterns,
  });

  // 경고 메시지 생성
  const warnings: string[] = [];
  if (sampleResult.fallback) {
    warnings.push('Fallback to random sampling');
  }
  if (sampleResult.actualSize === 0) {
    warnings.push('Empty collection');
  }
  const piiFields = fields.filter((f) => f.hints.length > 0);
  if (piiFields.length > 0) {
    warnings.push('PII detected');
  }

  // 변종 분석
  const variants = analyzeVariants(sampleResult.documents, { topN: config.variantTop });

  const schema: CollectionSchema = {
    name: collectionName,
    estimatedCount: collectionMeta?.estimatedCount || 0,
    sampledCount: sampleResult.actualSize,
    indexes: collectionMeta?.indexes || [],
    fields,
    variants,
    warnings,
  };

  // LLM을 통한 요약 생성 (config.llm === 'on'일 때)
  if (llmProvider) {
    const existingCollection = existingDescriptions?.collections.get(collectionName);

    // 기존 요약 재사용
    if (existingCollection?.summary && !config.force) {
      schema.summary = existingCollection.summary;
      logger.debug(`Reusing existing summary for ${collectionName}`);
    } else {
      // 신규 요약 생성
      try {
        logger.debug(`Generating LLM summary for ${collectionName}...`);

        const summaryInput = {
          collectionName: schema.name,
          fieldCount: schema.fields.length,
          sampleCount: schema.sampledCount,
          fieldPaths: schema.fields.map((f) => f.path),
          typeDistribution: schema.fields.reduce((acc, f) => {
            const primaryType = Object.keys(f.typeRatio)[0];
            if (primaryType) {
              acc[primaryType] = (acc[primaryType] || 0) + 1;
            }
            return acc;
          }, {} as Record<string, number>),
        };

        const summaryResponse = await generateSummary(llmProvider, summaryInput, explainOptions || {});
        if (summaryResponse) {
          schema.summary = composeSummary(summaryResponse);
          logger.debug(`LLM summary generated for ${collectionName}`);
        } else {
          logger.warn(`Failed to generate LLM summary for ${collectionName}`);
        }
      } catch (error) {
        logger.warn(`LLM summary generation failed for ${collectionName}: ${(error as Error).message}`);
        // Graceful degradation: 스키마는 정상적으로 반환
      }
    }

    // 필드 설명 생성은 2단계에서 외래키 컨텍스트와 함께 처리됨
    // 여기서는 스키마만 수집
  }

  return {
    schema,
    truncation: merged.truncationCounters,
  };
}

/**
 * 스키마 생성 파이프라인 실행
 */
export async function run(config: ResolvedConfig): Promise<number> {
  logger.configure({ verbose: config.verbose, redact: config.redact !== 'off' });
  logger.resetTimer();

  logger.info(`ExplainDB - MongoDB Observed Schema CLI`);
  logger.info(`Database: ${config.db}`);

  try {
    // LLM 옵션 설정
    const explainOptions: Partial<ExplainOptions> = { cacheEnabled: config.llmCache === 'on' };

    // LLM Provider 생성 (config.llm === 'on'일 때)
    let llmProvider: LLMProvider | undefined;
    if (config.llm === 'on') {
      logger.info('Initializing LLM provider...');
      logger.debug(`LLM Model: ${config.llmModel || 'default'}`);
      logger.debug(`LLM Region: ${config.llmRegion || 'default'}`);
      logger.debug(`LLM Cache: ${config.llmCache}`);

      try {
        llmProvider = createBedrockProvider(config.llmModel, config.llmRegion);
        logger.info('LLM provider initialized successfully');
      } catch (error) {
        logger.warn(`Failed to initialize LLM provider: ${(error as Error).message}`);
        logger.warn('Continuing without LLM features.');
      }
    }

    // 기존 스키마 로드 (incremental 모드)
    let existingDescriptions: ExistingDescriptions | null = null;
    if (config.incremental === 'on' && !config.force) {
      const schemaPath = join(config.out, config.db, 'artifacts', 'schema.json');
      const existingSchema = await loadSchemaJson(schemaPath);
      if (existingSchema) {
        existingDescriptions = extractDescriptions(existingSchema);
        logger.info(`Loaded existing schema with ${existingDescriptions.collections.size} collections`);
      }
    }

    // MongoDB 연결
    logger.info('Connecting to MongoDB...');
    const { db } = await connect(config.uri, config.db);

    // 컬렉션 스캔
    logger.info('Scanning collections...');
    const scanResult = await scan(db, {
      include: config.include,
      exclude: config.exclude,
    });

    logger.info(`Found ${scanResult.collections.length} collections`);

    if (scanResult.collections.length === 0) {
      logger.warn('No collections found matching the filter criteria');
      await disconnect();
      return EXIT_CODES.SUCCESS;
    }

    // 각 컬렉션 처리
    const schemas: CollectionSchema[] = [];
    const totalTruncation: TruncationCounters = {
      depthTruncated: 0,
      keysTruncated: 0,
      arraysTruncated: 0,
    };

    // 1단계: 스키마 수집 (병렬 처리)
    logger.info(`Processing ${scanResult.collections.length} collections...`);
    let completedCount = 0;
    const totalCount = scanResult.collections.length;

    const processResults = await runWithConcurrency(
      scanResult.collections,
      async (col) => {
        try {
          const result = await processCollection(db, col.name, config, llmProvider, existingDescriptions, explainOptions);
          completedCount++;
          logger.progressItem(completedCount, totalCount, col.name);
          return result;
        } catch (error) {
          logger.error(`Failed to process ${col.name}: ${(error as Error).message}`);
          if (config.samplingStrict) {
            throw error;
          }
          return null;
        }
      },
      config.concurrency
    );

    // 성공한 결과만 수집
    for (const result of processResults) {
      if (result) {
        schemas.push(result.schema);
        totalTruncation.depthTruncated += result.truncation.depthTruncated;
        totalTruncation.keysTruncated += result.truncation.keysTruncated;
        totalTruncation.arraysTruncated += result.truncation.arraysTruncated;
      }
    }

    // 2단계: LLM이 활성화된 경우 필드 설명 생성 (병렬 처리)
    if (llmProvider && schemas.length > 0) {
      logger.info('Generating field descriptions...');
      const foreignKeyMap = collectForeignKeyFields(schemas);

      if (foreignKeyMap.size > 0) {
        logger.debug(`Found ${foreignKeyMap.size} potential foreign key fields`);
      }

      // 필드 설명 생성 (병렬)
      await runWithConcurrency(
        schemas,
        async (schema) => {
          try {
            const existingCollection = existingDescriptions?.collections.get(schema.name);
            const existingFieldDescs = existingCollection?.fields;

            // 기존 설명 복원
            if (existingFieldDescs && !config.force) {
              for (const field of schema.fields) {
                const existing = existingFieldDescs.get(field.path);
                if (existing) {
                  field.description = existing;
                }
              }
            }

            // 신규 필드만 LLM 호출
            const sortedFields = [...schema.fields].sort((a, b) => b.presentRatio - a.presentRatio);
            const fieldsToDescribe = config.llmMaxFields
              ? sortedFields.slice(0, config.llmMaxFields)
              : sortedFields;

            const fieldsNeedingDescription = fieldsToDescribe.filter((field) =>
              config.force || !existingFieldDescs?.has(field.path) || !field.description
            );

            if (fieldsNeedingDescription.length > 0) {
              logger.debug(
                `Generating descriptions for ${fieldsNeedingDescription.length} new fields in ${schema.name}...`
              );

              const descriptionInputs: FieldDescriptionInput[] = fieldsNeedingDescription.map((field) => {
                const fkContext = inferForeignKeyContext(field.path, foreignKeyMap);
                return {
                  path: field.path,
                  typeRatio: Object.fromEntries(
                    Object.entries(field.typeRatio).map(([type, ratio]) => [type, ratio])
                  ),
                  presentRatio: field.presentRatio,
                  examples: field.examples.map((e) => e.value),
                  foreignKeyContext: fkContext,
                };
              });

              const descriptionsMap = await generateDescriptions(
                llmProvider,
                config.db,
                schema.name,
                descriptionInputs,
                explainOptions
              );

              // 경로 정규화 및 설명 적용
              const normalizedMap = new Map<string, string>();
              for (const [path, desc] of descriptionsMap) {
                const normalizedPath = path.replace(/\.(\*)\./g, '.[*].');
                normalizedMap.set(normalizedPath, desc);
                if (path !== normalizedPath) {
                  normalizedMap.set(path, desc);
                }
              }

              for (const field of schema.fields) {
                const description = normalizedMap.get(field.path);
                if (description) {
                  field.description = description;
                }
              }
            } else {
              logger.debug(`All fields already have descriptions for ${schema.name}`);
            }
          } catch (error) {
            logger.warn(`Description generation failed for ${schema.name}: ${(error as Error).message}`);
          }
        },
        config.concurrency
      );
    }

    // MongoDB 연결 해제
    await disconnect();

    // pruneRemovedCollections='off'일 때 기존 컬렉션 설명 유지
    if (config.pruneRemovedCollections === 'off' && existingDescriptions) {
      const currentCollectionNames = new Set(schemas.map((s) => s.name));

      for (const [collName, collData] of existingDescriptions.collections) {
        if (!currentCollectionNames.has(collName)) {
          logger.info(`Preserving removed collection: ${collName}`);

          // TODO: 기존 스키마 정보를 schemas 배열에 추가하는 로직 구현 필요
          // 현재는 로그만 남기고, 향후 다음 작업 필요:
          // 1. collData에서 CollectionSchema 재구성
          // 2. estimatedCount, sampledCount는 0 또는 기존 값 유지
          // 3. indexes, variants는 빈 배열로 설정
          // 4. warnings에 "Preserved from previous run" 추가
          // 5. schemas 배열에 추가
        }
      }
    }

    // 메타데이터 생성
    const meta: RunMeta = {
      generatedAt: formatDateWithOffset(new Date()),
      database: config.db,
      sampling: {
        strategy: config.timeField ? 'time-window' : config.match ? 'filtered' : 'random',
        size: config.sampleSize,
        timeField: config.timeField,
        timeWindowDays: config.timeWindowDays,
        match: config.match,
      },
      options: {
        maxDepth: config.maxDepth,
        redact: config.redact,
        llm: config.llm,
      },
      truncationCounters: totalTruncation,
    };

    // 출력 렌더링
    logger.info('Generating documentation...');

    const dbOutDir = await ensureOutputDirs(config.out, config.db);

    // README.md 작성
    const readmeContent = renderReadme(schemas, meta);
    await writeFile(join(dbOutDir, 'README.md'), readmeContent, 'utf-8');
    logger.debug('Generated README.md');

    // 컬렉션 문서 작성
    for (const schema of schemas) {
      const content = renderCollection(schema);
      await writeFile(join(dbOutDir, 'collections', `${schema.name}.md`), content, 'utf-8');
      logger.debug(`Generated ${schema.name}.md`);
    }

    // schema.json 작성
    const schemaOutput = renderSchemaJson(schemas, meta);
    await writeFile(
      join(dbOutDir, 'artifacts', 'schema.json'),
      stringifySchemaJson(schemaOutput),
      'utf-8'
    );
    logger.debug('Generated schema.json');

    logger.success(`Documentation generated in ${dbOutDir}/`);
    logger.info(`- README.md`);
    logger.info(`- collections/*.md (${schemas.length} files)`);
    logger.info(`- artifacts/schema.json`);

    return EXIT_CODES.SUCCESS;
  } catch (error) {
    const err = error as Error;

    if (err.message.includes('인증 실패')) {
      logger.error(err.message);
      return EXIT_CODES.AUTH_FAILURE;
    }

    if (err.message.includes('연결 실패')) {
      logger.error(err.message);
      return EXIT_CODES.CONNECTION_FAILURE;
    }

    logger.error(`Unexpected error: ${err.message}`);
    if (config.verbose) {
      console.error(err.stack);
    }

    return EXIT_CODES.RENDER_FAILURE;
  }
}
