import type { RedactedExample } from '../../types/schema';
import { detectBsonType } from '../../types/bson';
import { detectPII } from './detector';

// 마스킹 관련 상수
const MAX_MASKED_LENGTH = 10;
const MIN_VISIBLE_CHARS = 3;
const MIN_VISIBLE_RATIO = 4;

export type RedactMode = 'strict' | 'balanced';

export interface MaskOptions {
  mode: RedactMode;
}

const DEFAULT_OPTIONS: MaskOptions = {
  mode: 'balanced',
};

/**
 * 문자열 값 마스킹
 * - strict: 대부분의 문자를 *로 치환
 * - balanced: 처음과 끝 문자 표시
 */
function maskString(value: string, mode: RedactMode): string {
  if (value.length <= 2) {
    return '*'.repeat(value.length);
  }

  if (mode === 'strict') {
    return value[0] + '*'.repeat(Math.min(value.length - 1, MAX_MASKED_LENGTH));
  }

  // balanced 모드
  if (value.length <= MIN_VISIBLE_RATIO) {
    return value[0] + '*'.repeat(value.length - 2) + value[value.length - 1];
  }

  const visibleChars = Math.min(
    MIN_VISIBLE_CHARS,
    Math.floor(value.length / MIN_VISIBLE_RATIO)
  );
  const maskedLength = Math.min(
    value.length - visibleChars * 2,
    MAX_MASKED_LENGTH
  );
  return (
    value.substring(0, visibleChars) +
    '*'.repeat(maskedLength) +
    value.substring(value.length - visibleChars)
  );
}

/**
 * 이메일 주소 마스킹
 */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return maskString(email, 'balanced');

  const maskedLocal = local.length > 1 ? local[0] + '***' : '*';
  const domainParts = domain.split('.');
  const maskedDomain =
    domainParts.length > 1
      ? domainParts[0][0] + '***.' + domainParts.slice(-1)[0]
      : maskString(domain, 'balanced');

  return `${maskedLocal}@${maskedDomain}`;
}

/**
 * 전화번호 마스킹
 */
function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '*'.repeat(phone.length);

  const lastFour = digits.slice(-4);
  return '*'.repeat(digits.length - 4) + lastFour;
}

/**
 * 숫자 값 마스킹
 */
function maskNumber(value: number): string {
  const str = value.toString();
  if (str.length <= 2) return str;
  return str[0] + '*'.repeat(str.length - 2) + str[str.length - 1];
}

/**
 * 값을 마스킹하고 redacted example 반환
 */
export function mask(
  value: unknown,
  path: string,
  options: Partial<MaskOptions> = {}
): RedactedExample {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const type = detectBsonType(value);
  const hints = detectPII(path, value);

  if (value === null) {
    return { value: 'null', type, hints };
  }

  if (value === undefined) {
    return { value: 'undefined', type, hints };
  }

  if (typeof value === 'boolean') {
    return { value: value.toString(), type, hints };
  }

  if (typeof value === 'number') {
    return { value: maskNumber(value), type, hints };
  }

  if (typeof value === 'string') {
    // 특정 패턴 확인
    if (hints.includes('email')) {
      return { value: maskEmail(value), type, hints };
    }
    if (hints.includes('phone')) {
      return { value: maskPhone(value), type, hints };
    }
    return { value: maskString(value, opts.mode), type, hints };
  }

  if (value instanceof Date) {
    return { value: value.toISOString().replace(/\d/g, '*'), type, hints };
  }

  if (Array.isArray(value)) {
    return { value: `[Array(${value.length})]`, type, hints };
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    // MongoDB ObjectId 처리
    if (obj._bsontype === 'ObjectId' || obj._bsontype === 'ObjectID') {
      const id = obj.toString?.() || JSON.stringify(obj);
      return { value: maskString(id, opts.mode), type, hints };
    }
    // 기타 BSON 타입 처리
    if (obj._bsontype) {
      return { value: `[${obj._bsontype}]`, type, hints };
    }
    const keys = Object.keys(obj);
    return { value: `{Object(${keys.length} keys)}`, type, hints };
  }

  return { value: '[Unknown]', type, hints };
}

/**
 * 마스킹 적용 여부 확인
 */
export function shouldMask(redact: 'on' | 'off'): boolean {
  return redact === 'on';
}
