import type { FieldStats } from '../../types/schema';

/**
 * 숫자 값의 통계 계산
 */
export function calculateStats(values: number[]): FieldStats {
  if (values.length === 0) {
    return { min: 0, max: 0, avg: 0 };
  }

  let min = values[0];
  let max = values[0];
  let sum = 0;

  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }

  const avg = sum / values.length;

  return { min, max, avg };
}

/**
 * 백분위수 계산
 */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) {
    return sorted[lower];
  }

  const fraction = index - lower;
  return sorted[lower] * (1 - fraction) + sorted[upper] * fraction;
}

/**
 * 표준편차 계산
 */
export function stdDev(values: number[], avg: number): number {
  if (values.length <= 1) return 0;

  const squaredDiffs = values.map((v) => Math.pow(v - avg, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;

  return Math.sqrt(avgSquaredDiff);
}
