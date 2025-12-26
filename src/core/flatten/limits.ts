/**
 * 문서 평탄화를 위한 깊이 및 키 제한 설정
 */

export interface FlattenLimits {
  maxDepth: number;
  maxKeysPerDoc: number;
  maxArraySample: number;
}

/**
 * 기본 flatten 제한값
 */
export const DEFAULT_LIMITS: FlattenLimits = {
  maxDepth: 20,
  maxKeysPerDoc: 2000,
  maxArraySample: 50,
};

/**
 * 기본값으로 제한 설정 생성
 */
export function createLimits(overrides?: Partial<FlattenLimits>): FlattenLimits {
  return {
    ...DEFAULT_LIMITS,
    ...overrides,
  };
}

/**
 * 제한 설정 유효성 검사
 */
export function validateLimits(limits: FlattenLimits): void {
  if (limits.maxDepth < 1 || limits.maxDepth > 100) {
    throw new Error('maxDepth must be between 1 and 100');
  }
  if (limits.maxKeysPerDoc < 1 || limits.maxKeysPerDoc > 10000) {
    throw new Error('maxKeysPerDoc must be between 1 and 10000');
  }
  if (limits.maxArraySample < 1 || limits.maxArraySample > 1000) {
    throw new Error('maxArraySample must be between 1 and 1000');
  }
}
