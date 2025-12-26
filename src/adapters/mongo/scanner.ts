import type { Db } from 'mongodb';
import { minimatch } from 'minimatch';
import type { CollectionMeta, IndexInfo, ScanResult } from '../../types/schema';
import { hashObject } from '../../utils/hash';
import { logger } from '../../cli/logger';

export interface ScanOptions {
  include?: string;
  exclude?: string;
}

/**
 * 컬렉션명이 필터 패턴과 일치하는지 확인
 * minimatch로 glob 패턴 지원: *, ?, {a,b,c}, [abc] 등
 */
function matchesFilter(name: string, options: ScanOptions): boolean {
  if (name.startsWith('system.')) {
    return false;
  }

  if (options.include && !minimatch(name, options.include)) {
    return false;
  }

  if (options.exclude && minimatch(name, options.exclude)) {
    return false;
  }

  return true;
}

/**
 * 컬렉션의 인덱스 정보 조회
 */
async function getIndexes(db: Db, collectionName: string): Promise<IndexInfo[]> {
  try {
    const collection = db.collection(collectionName);
    const indexes = await collection.indexes();

    return indexes.map((idx) => ({
      name: idx.name || '',
      key: idx.key as Record<string, number>,
      unique: idx.unique || false,
      sparse: idx.sparse,
      expireAfterSeconds: idx.expireAfterSeconds,
    }));
  } catch (error) {
    logger.warn(`Failed to get indexes for ${collectionName}: ${(error as Error).message}`);
    return [];
  }
}

/**
 * 데이터베이스 스캔하여 컬렉션 및 메타데이터 수집
 */
export async function scan(db: Db, options: ScanOptions = {}): Promise<ScanResult> {
  const startTime = Date.now();

  logger.debug('Scanning collections...');

  const collections = await db.listCollections().toArray();
  const result: CollectionMeta[] = [];

  for (const collInfo of collections) {
    const name = collInfo.name;

    if (!matchesFilter(name, options)) {
      logger.debug(`Skipping collection: ${name}`);
      continue;
    }

    logger.debug(`Scanning collection: ${name}`);

    try {
      const collection = db.collection(name);

      const estimatedCount = await collection.estimatedDocumentCount();

      const indexes = await getIndexes(db, name);

      const fingerprint = hashObject(indexes);

      result.push({
        name,
        estimatedCount,
        indexes,
        fingerprint,
      });
    } catch (error) {
      logger.warn(`Failed to scan collection ${name}: ${(error as Error).message}`);
    }
  }

  const scanTime = Date.now() - startTime;
  logger.debug(`Scan complete: ${result.length} collections in ${scanTime}ms`);

  return {
    collections: result.sort((a, b) => a.name.localeCompare(b.name)),
    scanTime,
  };
}
