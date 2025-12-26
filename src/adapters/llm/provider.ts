/**
 * 문서 생성을 위한 LLM Provider 인터페이스
 */

export interface CollectionSummaryInput {
  collectionName: string;
  fieldCount: number;
  sampleCount: number;
  fieldPaths: string[];
  typeDistribution: Record<string, number>;
}

export interface CollectionSummary {
  purpose: string;
  structure: string;
  notes: string | null;
}

export interface FieldDescriptionInput {
  path: string;
  typeRatio: Record<string, number>;
  presentRatio: number;
  examples: string[];
  foreignKeyContext?: string[];
}

export interface FieldDescription {
  path: string;
  description: string;
}

export interface LLMProvider {
  name: string;

  generateCollectionSummary(input: CollectionSummaryInput): Promise<CollectionSummary>;
  generateFieldDescriptions(inputs: FieldDescriptionInput[]): Promise<FieldDescription[]>;
}

export interface LLMProviderOptions {
  provider: string;
  model?: string;
  region?: string;
  maxRetries: number;
  cacheEnabled: boolean;
}

export const DEFAULT_LLM_OPTIONS: LLMProviderOptions = {
  provider: 'bedrock',
  maxRetries: 3,
  cacheEnabled: true,
};
