import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { sha256 } from '../../utils/hash';
import { logger } from '../../cli/logger';

const CACHE_DIR = '.explaindb-cache';

interface CacheEntry {
  key: string;
  value: string;
  createdAt: string;
}

/**
 * 입력으로부터 cache 키 생성
 */
export function generateCacheKey(input: unknown): string {
  const json = JSON.stringify(input, Object.keys(input as object).sort());
  return sha256(json);
}

/**
 * 캐시된 값 조회
 */
export async function getCached(key: string, cacheDir = CACHE_DIR): Promise<string | null> {
  try {
    const filePath = join(cacheDir, `${key}.json`);
    const content = await readFile(filePath, 'utf-8');
    const entry: CacheEntry = JSON.parse(content);
    return entry.value;
  } catch {
    return null;
  }
}

/**
 * 캐시 값 설정
 */
export async function setCached(key: string, value: string, cacheDir = CACHE_DIR): Promise<void> {
  try {
    const filePath = join(cacheDir, `${key}.json`);
    await mkdir(dirname(filePath), { recursive: true });

    const entry: CacheEntry = {
      key,
      value,
      createdAt: new Date().toISOString(),
    };

    await writeFile(filePath, JSON.stringify(entry, null, 2), 'utf-8');
    logger.debug(`Cached result: ${key}`);
  } catch (error) {
    logger.warn(`Failed to cache result: ${(error as Error).message}`);
  }
}

/**
 * 캐시 삭제
 */
export async function clearCache(cacheDir = CACHE_DIR): Promise<void> {
  // 구현 시 cache 디렉토리 삭제
  logger.debug(`Clearing cache: ${cacheDir}`);
}
