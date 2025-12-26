import { createHash } from 'crypto';

/**
 * 입력 문자열의 SHA256 해시 생성
 */
export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * 객체의 SHA256 해시 생성 (JSON 직렬화)
 */
export function hashObject(obj: unknown): string {
  const json = JSON.stringify(obj, Object.keys(obj as object).sort());
  return sha256(json);
}

/**
 * 짧은 해시 생성 (앞 8자리)
 */
export function shortHash(input: string): string {
  return sha256(input).substring(0, 8);
}
