/**
 * CLI 출력용 마스킹 인식 로거
 * 민감한 데이터가 로그에 노출되지 않도록 보장
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// 프로그레스 바 표시 상수
const PROGRESS_BAR_WIDTH = 20;
const PROGRESS_BAR_SEGMENT = 5;

interface LoggerOptions {
  verbose: boolean;
  redact: boolean;
}

const PII_PATTERNS = [
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, // email
  /\+?\d{1,4}[-.\s]?\(?\d{1,3}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g, // phone
  /\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/g, // SSN
  /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, // credit card
  /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, // JWT
];

class Logger {
  private verbose = false;
  private redact = true;
  private startTime = Date.now();

  configure(options: Partial<LoggerOptions>): void {
    if (options.verbose !== undefined) {
      this.verbose = options.verbose;
    }
    if (options.redact !== undefined) {
      this.redact = options.redact;
    }
  }

  private redactMessage(message: string): string {
    if (!this.redact) {
      return message;
    }

    let result = message;
    for (const pattern of PII_PATTERNS) {
      result = result.replace(pattern, '[REDACTED]');
    }
    return result;
  }

  private formatTime(): string {
    const elapsed = Date.now() - this.startTime;
    const seconds = Math.floor(elapsed / 1000);
    const ms = elapsed % 1000;
    return `[${seconds}.${ms.toString().padStart(3, '0')}s]`;
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.verbose) {
      const redacted = this.redactMessage(message);
      console.log(`${this.formatTime()} [DEBUG] ${redacted}`, ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    const redacted = this.redactMessage(message);
    console.log(`${this.formatTime()} [INFO] ${redacted}`, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    const redacted = this.redactMessage(message);
    console.warn(`${this.formatTime()} [WARN] ${redacted}`, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    const redacted = this.redactMessage(message);
    console.error(`${this.formatTime()} [ERROR] ${redacted}`, ...args);
  }

  progress(current: number, total: number, message: string): void {
    const percent = Math.round((current / total) * 100);
    const filled = Math.floor(percent / PROGRESS_BAR_SEGMENT);
    const bar = '█'.repeat(filled) + '░'.repeat(PROGRESS_BAR_WIDTH - filled);
    process.stdout.write(`\r[${bar}] ${percent}% ${message}`);
    if (current === total) {
      console.log();
    }
  }

  progressItem(current: number, total: number, item: string): void {
    console.log(`[${current}/${total}] ${item} 처리 중...`);
  }

  success(message: string): void {
    console.log(`✓ ${message}`);
  }

  resetTimer(): void {
    this.startTime = Date.now();
  }
}

export const logger = new Logger();
