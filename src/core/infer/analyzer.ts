import { BsonType, detectBsonType } from '../../types/bson';
import type { PathValue } from '../../types/schema';

/**
 * 값으로부터 BSON 타입 분류
 */
export function classifyType(value: unknown): BsonType {
  return detectBsonType(value);
}

/**
 * path 값들로부터 타입 분포 계산
 */
export function getTypeDistribution(values: PathValue[]): Map<BsonType, number> {
  const typeCounts = new Map<BsonType, number>();

  for (const pv of values) {
    const count = typeCounts.get(pv.type) || 0;
    typeCounts.set(pv.type, count + 1);
  }

  return typeCounts;
}

/**
 * 카운트로부터 타입 비율 계산
 */
export function calculateTypeRatio(
  typeCounts: Map<BsonType, number>,
  total: number
): Partial<Record<BsonType, number>> {
  const ratio: Partial<Record<BsonType, number>> = {};

  for (const [type, count] of typeCounts) {
    ratio[type] = count / total;
  }

  return ratio;
}

/**
 * 필드가 혼합 타입인지 확인
 */
export function hasMixedTypes(typeCounts: Map<BsonType, number>): boolean {
  // null과 undefined는 "혼합"으로 카운트하지 않음
  const meaningfulTypes = Array.from(typeCounts.keys()).filter(
    (t) => t !== BsonType.Null && t !== BsonType.Undefined
  );
  return meaningfulTypes.length > 1;
}

/**
 * 주요 타입 추출 (가장 흔한 non-null 타입)
 */
export function getPrimaryType(typeCounts: Map<BsonType, number>): BsonType | null {
  let maxCount = 0;
  let primaryType: BsonType | null = null;

  for (const [type, count] of typeCounts) {
    if (type !== BsonType.Null && type !== BsonType.Undefined && count > maxCount) {
      maxCount = count;
      primaryType = type;
    }
  }

  return primaryType;
}

/**
 * 타입이 숫자형인지 확인
 */
export function isNumericType(type: BsonType): boolean {
  return [BsonType.Int, BsonType.Long, BsonType.Double, BsonType.Decimal].includes(type);
}
