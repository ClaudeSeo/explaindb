import type { LLMProvider, LLMProviderOptions } from './provider';
import { logger } from '../../cli/logger';

const providers = new Map<string, () => LLMProvider>();

/**
 * LLM provider 등록
 */
export function registerProvider(name: string, factory: () => LLMProvider): void {
  providers.set(name, factory);
}

/**
 * 이름으로 LLM provider 조회
 */
export function getProvider(options: LLMProviderOptions): LLMProvider | null {
  const factory = providers.get(options.provider);

  if (!factory) {
    logger.warn(`LLM provider '${options.provider}' not found. Available: ${Array.from(providers.keys()).join(', ')}`);
    return null;
  }

  return factory();
}

/**
 * 사용 가능한 provider 목록 반환
 */
export function listProviders(): string[] {
  return Array.from(providers.keys());
}
