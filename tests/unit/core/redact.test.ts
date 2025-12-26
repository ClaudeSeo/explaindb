import { test, expect, describe } from 'bun:test';
import { mask, shouldMask } from '../../../src/core/redact/masker';
import { detectPII, isPIIField, getPIIWarning } from '../../../src/core/redact/detector';
import { BsonType } from '../../../src/types/bson';

describe('mask', () => {
  test('should mask string values', () => {
    const result = mask('hello world', 'field');
    expect(result.value).not.toBe('hello world');
    expect(result.value.includes('*')).toBe(true);
  });

  test('should mask email addresses specially', () => {
    const result = mask('john.doe@example.com', 'email');
    expect(result.value).toContain('@');
    expect(result.value).not.toBe('john.doe@example.com');
    expect(result.hints).toContain('email');
  });

  test('should mask phone numbers', () => {
    const result = mask('+1-555-123-4567', 'phone');
    expect(result.value).not.toBe('+1-555-123-4567');
    expect(result.hints).toContain('phone');
  });

  test('should handle null values', () => {
    const result = mask(null, 'field');
    expect(result.value).toBe('null');
    expect(result.type).toBe(BsonType.Null);
  });

  test('should handle boolean values', () => {
    const result = mask(true, 'field');
    expect(result.value).toBe('true');
  });

  test('should mask numbers', () => {
    const result = mask(12345, 'field');
    expect(result.value).not.toBe('12345');
    expect(result.value.includes('*')).toBe(true);
  });

  test('should handle arrays', () => {
    const result = mask([1, 2, 3], 'field');
    expect(result.value).toContain('Array');
    expect(result.value).toContain('3');
  });

  test('should handle objects', () => {
    const result = mask({ a: 1, b: 2 }, 'field');
    expect(result.value).toContain('Object');
  });

  test('should use strict mode when specified', () => {
    const balanced = mask('hello', 'field', { mode: 'balanced' });
    const strict = mask('hello', 'field', { mode: 'strict' });

    // Both should mask but strict should hide more
    expect(balanced.value.includes('*')).toBe(true);
    expect(strict.value.includes('*')).toBe(true);
  });
});

describe('shouldMask', () => {
  test('should return true when redact is on', () => {
    expect(shouldMask('on')).toBe(true);
  });

  test('should return false when redact is off', () => {
    expect(shouldMask('off')).toBe(false);
  });
});

describe('detectPII', () => {
  test('should detect email pattern in field name', () => {
    const hints = detectPII('userEmail', 'test@example.com');
    expect(hints).toContain('email');
  });

  test('should detect email pattern in value', () => {
    const hints = detectPII('field', 'test@example.com');
    expect(hints).toContain('email');
  });

  test('should detect phone pattern', () => {
    const hints = detectPII('phoneNumber', '+1-555-123-4567');
    expect(hints).toContain('phone');
  });

  test('should detect password field', () => {
    const hints = detectPII('password', 'secret123');
    expect(hints).toContain('password');
  });

  test('should detect token field', () => {
    const hints = detectPII('accessToken', 'abc123');
    expect(hints).toContain('token');
  });

  test('should detect SSN pattern', () => {
    const hints = detectPII('field', '123-45-6789');
    expect(hints).toContain('ssn');
  });

  test('should detect credit card pattern', () => {
    const hints = detectPII('field', '4111 1111 1111 1111');
    expect(hints).toContain('credit_card');
  });

  test('should detect JWT pattern', () => {
    const hints = detectPII('field', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c');
    expect(hints).toContain('jwt');
  });

  test('should detect UUID pattern', () => {
    const hints = detectPII('field', '123e4567-e89b-12d3-a456-426614174000');
    expect(hints).toContain('uuid');
  });

  test('should detect IP address pattern', () => {
    const hints = detectPII('field', '192.168.1.1');
    expect(hints).toContain('ip_address');
  });

  test('should return empty array for non-PII', () => {
    const hints = detectPII('title', 'Hello World');
    expect(hints).toHaveLength(0);
  });

  test('should detect name field as PII', () => {
    const hints = detectPII('name', 'John');
    expect(hints).toContain('name');
  });

  test('should detect address child fields as PII (parent inheritance)', () => {
    // address 필드 자체
    expect(detectPII('address', '서울시 강남구')).toContain('address');
    // address 하위 필드들도 PII로 인식
    expect(detectPII('address.detail', '강남대로 123')).toContain('address');
    expect(detectPII('address.base', '서울시')).toContain('address');
    // 배열 내 address 하위 필드
    expect(detectPII('familyMembers.[*].address.detail', '부산시')).toContain('address');
  });

  test('should detect location child fields as PII (parent inheritance)', () => {
    expect(detectPII('location', '37.123, 127.456')).toContain('location');
    expect(detectPII('location.lat', '37.123')).toContain('location');
    expect(detectPII('location.lng', '127.456')).toContain('location');
  });

  test('should detect custom pattern fields as PII', () => {
    const customPatterns = ['kakao.*', 'social.*'];

    // kakao.* 패턴 매칭
    expect(detectPII('kakao.accessToken', 'token123', customPatterns)).toContain('kakao');
    expect(detectPII('kakao.refreshToken', 'refresh456', customPatterns)).toContain('kakao');
    expect(detectPII('user.kakao.id', 'id789', customPatterns)).toContain('kakao');

    // social.* 패턴 매칭
    expect(detectPII('social.google.id', 'google123', customPatterns)).toContain('social');

    // 패턴에 없는 필드는 매칭되지 않음
    expect(detectPII('apple.id', 'apple123', customPatterns)).not.toContain('apple');
  });

  test('should not match custom pattern for exact field (only children)', () => {
    const customPatterns = ['kakao.*'];

    // kakao 자체는 매칭되지 않음 (하위 필드만)
    expect(detectPII('kakao', 'value', customPatterns)).not.toContain('kakao');
    // kakao 하위 필드는 매칭됨
    expect(detectPII('kakao.id', 'value', customPatterns)).toContain('kakao');
  });
});

describe('isPIIField', () => {
  test('should return true for email field', () => {
    expect(isPIIField('email')).toBe(true);
    expect(isPIIField('userEmail')).toBe(true);
    expect(isPIIField('user.email')).toBe(true);
  });

  test('should return true for password field', () => {
    expect(isPIIField('password')).toBe(true);
    expect(isPIIField('userPassword')).toBe(true);
  });

  test('should return false for regular field', () => {
    expect(isPIIField('title')).toBe(false);
    expect(isPIIField('createdAt')).toBe(false);
  });

  test('should return true for name field', () => {
    expect(isPIIField('name')).toBe(true);
    expect(isPIIField('userName')).toBe(true);
  });

  test('should return true for address child fields (parent inheritance)', () => {
    expect(isPIIField('address')).toBe(true);
    expect(isPIIField('address.detail')).toBe(true);
    expect(isPIIField('address.base')).toBe(true);
    expect(isPIIField('user.address.city')).toBe(true);
  });

  test('should return true for custom pattern fields', () => {
    const customPatterns = ['kakao.*'];
    expect(isPIIField('kakao.accessToken', customPatterns)).toBe(true);
    expect(isPIIField('kakao.refreshToken', customPatterns)).toBe(true);
    // kakao 자체는 false (하위 필드만)
    expect(isPIIField('kakao', customPatterns)).toBe(false);
  });
});

describe('getPIIWarning', () => {
  test('should return warning message for hints', () => {
    const warning = getPIIWarning(['email', 'phone']);
    expect(warning).toContain('Email');
    expect(warning).toContain('Phone');
  });

  test('should return null for empty hints', () => {
    const warning = getPIIWarning([]);
    expect(warning).toBeNull();
  });
});
