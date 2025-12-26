/**
 * 필드명 및 값에서 PII 패턴 감지
 */

// PII를 암시하는 필드명 패턴 (마지막 필드명 매칭)
const PII_FIELD_PATTERNS: Array<[RegExp, string]> = [
  [/email/i, 'email'],
  [/e[-_]?mail/i, 'email'],
  [/phone/i, 'phone'],
  [/mobile/i, 'phone'],
  [/tel(?:ephone)?/i, 'phone'],
  [/password/i, 'password'],
  [/passwd/i, 'password'],
  [/pwd/i, 'password'],
  [/secret/i, 'secret'],
  [/token/i, 'token'],
  [/api[-_]?key/i, 'api_key'],
  [/access[-_]?key/i, 'access_key'],
  [/auth/i, 'auth'],
  [/ssn/i, 'ssn'],
  [/serial/i, 'ssn'],
  [/social[-_]?security/i, 'ssn'],
  [/credit[-_]?card/i, 'credit_card'],
  [/card[-_]?number/i, 'credit_card'],
  [/cvv/i, 'cvv'],
  [/cvc/i, 'cvv'],
  [/address/i, 'address'],
  [/birth[-_]?date/i, 'birthdate'],
  [/dob/i, 'birthdate'],
  [/ip[-_]?address/i, 'ip_address'],
  [/^ci$/i, 'ci'],
  [/^di$/i, 'di'],
  [/salt/i, 'salt'],
  [/name/i, 'name'],
];

// PII를 상속하는 상위 필드 패턴 (하위 필드도 PII로 처리)
const PII_PARENT_PATTERNS: Array<[RegExp, string]> = [
  [/^address$/i, 'address'],
  [/^location$/i, 'location'],
];

// PII를 암시하는 값 패턴
const PII_VALUE_PATTERNS: Array<[RegExp, string]> = [
  [/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, 'email'],
  [/^\+?\d{1,4}[-.\s]?\(?\d{1,3}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}$/, 'phone'],
  [/^\d{3}[-]?\d{2}[-]?\d{4}$/, 'ssn'],
  [/^\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}$/, 'credit_card'],
  [/^eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/, 'jwt'],
  [/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'uuid'],
  [
    /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/,
    'ip_address',
  ],
  [/^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/, 'ip_address'],
];

/**
 * 필드 path와 값에서 PII 패턴 감지
 * hint 문자열 배열 반환
 * @param customPatterns - 커스텀 PII 패턴 (예: ["kakao.*", "social.*"])
 */
export function detectPII(
  path: string,
  value: unknown,
  customPatterns?: string[]
): string[] {
  const hints: Set<string> = new Set();

  // 1. 필드명 확인 (마지막 세그먼트)
  const fieldName = path.split('.').pop() || path;
  for (const [pattern, hint] of PII_FIELD_PATTERNS) {
    if (pattern.test(fieldName)) {
      hints.add(hint);
    }
  }

  // 2. 상위 경로 확인 (address.detail → address가 상위에 있으면 PII)
  const pathSegments = path.split('.');
  for (const segment of pathSegments) {
    // [*] 같은 배열 인덱스 제외
    if (segment.startsWith('[')) continue;
    for (const [pattern, hint] of PII_PARENT_PATTERNS) {
      if (pattern.test(segment)) {
        hints.add(hint);
      }
    }
  }

  // 3. 커스텀 패턴 확인 (예: kakao.* → kakao 하위 모든 필드)
  if (customPatterns) {
    for (const pattern of customPatterns) {
      if (matchCustomPattern(path, pattern)) {
        // 패턴에서 필드명 추출 (kakao.* → kakao)
        const patternName =
          pattern.replace(/\.\*$/, '').split('.').pop() || pattern;
        hints.add(patternName);
      }
    }
  }

  // 4. 값 패턴 확인
  if (typeof value === 'string') {
    for (const [pattern, hint] of PII_VALUE_PATTERNS) {
      if (pattern.test(value)) {
        hints.add(hint);
      }
    }
  }

  return Array.from(hints);
}

/**
 * 커스텀 패턴 매칭
 * 예: "kakao.*" → "kakao.accessToken", "kakao.refreshToken" 매칭
 */
function matchCustomPattern(path: string, pattern: string): boolean {
  // "kakao.*" → kakao로 시작하는 모든 하위 필드
  if (pattern.endsWith('.*')) {
    const prefix = pattern.slice(0, -2); // "kakao.*" → "kakao"
    // 정확히 prefix로 시작하거나, prefix. 또는 prefix[로 시작해야 함
    const segments = path.split('.');
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i].replace(/\[\*\]$/, ''); // [*] 제거
      if (segment.toLowerCase() === prefix.toLowerCase()) {
        // 이 세그먼트 이후에 더 있으면 하위 필드
        return i < segments.length - 1;
      }
    }
    return false;
  }

  // 정확히 일치
  return path.toLowerCase() === pattern.toLowerCase();
}

/**
 * path 이름 기반으로 필드가 PII일 가능성 확인
 */
export function isPIIField(path: string, customPatterns?: string[]): boolean {
  // 필드명 패턴 확인
  const fieldName = path.split('.').pop() || path;
  if (PII_FIELD_PATTERNS.some(([pattern]) => pattern.test(fieldName))) {
    return true;
  }

  // 상위 경로 패턴 확인
  const pathSegments = path.split('.');
  for (const segment of pathSegments) {
    if (segment.startsWith('[')) continue;
    if (PII_PARENT_PATTERNS.some(([pattern]) => pattern.test(segment))) {
      return true;
    }
  }

  // 커스텀 패턴 확인
  if (customPatterns) {
    for (const pattern of customPatterns) {
      if (matchCustomPattern(path, pattern)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * 필드의 PII 경고 메시지 생성
 */
export function getPIIWarning(hints: string[]): string | null {
  if (hints.length === 0) return null;

  const warnings: Record<string, string> = {
    email: 'Email address detected',
    phone: 'Phone number detected',
    password: 'Password field detected',
    secret: 'Secret field detected',
    token: 'Token field detected',
    api_key: 'API key detected',
    access_key: 'Access key detected',
    auth: 'Authentication field detected',
    ssn: 'SSN detected',
    credit_card: 'Credit card number detected',
    cvv: 'CVV detected',
    address: 'Address field detected',
    birthdate: 'Birthdate detected',
    ip_address: 'IP address detected',
    jwt: 'JWT token detected',
    uuid: 'UUID detected',
    ci: 'CI detected',
    di: 'DI detected',
    salt: 'Salt value detected',
    name: 'Name field detected',
  };

  return hints.map((h) => warnings[h] || `PII: ${h}`).join(', ');
}

/**
 * 값과 경로가 PII를 포함하는지 확인
 */
export function hasPII(
  value: unknown,
  path: string,
  customPatterns?: string[]
): boolean {
  const hints = detectPII(path, value, customPatterns);
  return hints.length > 0;
}
