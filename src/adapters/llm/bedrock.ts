import type {
  LLMProvider,
  CollectionSummaryInput,
  CollectionSummary,
  FieldDescriptionInput,
  FieldDescription,
} from './provider';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { logger } from '../../cli/logger';
import {
  buildCollectionSummaryPrompt,
  buildFieldDescriptionsPrompt,
  parseCollectionSummaryResponse,
  parseFieldDescriptionsResponse,
} from '../../core/explain/prompts';

// Bedrock 기본 설정
const DEFAULT_BEDROCK_MODEL = 'anthropic.claude-3-5-haiku-20241022-v1:0';
const DEFAULT_AWS_REGION = 'ap-northeast-2';

/**
 * AWS Bedrock LLM Provider
 * AWS SDK를 사용한 실제 Bedrock Converse API 호출
 */
export class BedrockProvider implements LLMProvider {
  name = 'bedrock';

  private model: string;
  private region: string;
  private client: BedrockRuntimeClient;

  constructor(model?: string, region?: string) {
    this.model = model || DEFAULT_BEDROCK_MODEL;
    this.region = region || DEFAULT_AWS_REGION;
    this.client = new BedrockRuntimeClient({ region: this.region });
  }

  async generateCollectionSummary(input: CollectionSummaryInput): Promise<CollectionSummary> {
    logger.debug(`Generating summary for collection: ${input.collectionName}`);

    // 프롬프트 빌더 사용
    const prompt = buildCollectionSummaryPrompt(input);

    // Bedrock Converse API 호출
    const command = new ConverseCommand({
      modelId: this.model,
      messages: [
        {
          role: 'user',
          content: [{ text: prompt }],
        },
      ],
    });

    const response = await this.client.send(command);
    const responseText = response.output?.message?.content?.[0]?.text || '';

    // JSON 파싱 시도
    const parsed = parseCollectionSummaryResponse(responseText);
    if (parsed) {
      return parsed;
    }

    // Fallback
    return {
      purpose: `${input.collectionName} 컬렉션이다.`,
      structure: `${input.fieldCount}개의 필드로 구성되어 있다.`,
      notes: null,
    };
  }

  async generateFieldDescriptions(inputs: FieldDescriptionInput[]): Promise<FieldDescription[]> {
    logger.debug(`Generating descriptions for ${inputs.length} fields`);

    // 프롬프트 빌더 사용
    const prompt = buildFieldDescriptionsPrompt(inputs);

    // Bedrock Converse API 호출
    const command = new ConverseCommand({
      modelId: this.model,
      messages: [
        {
          role: 'user',
          content: [{ text: prompt }],
        },
      ],
    });

    const response = await this.client.send(command);
    const responseText = response.output?.message?.content?.[0]?.text || '';

    // JSON 파싱 시도
    const parsed = parseFieldDescriptionsResponse(responseText);
    if (parsed?.descriptions) {
      return parsed.descriptions;
    }

    // Fallback
    return inputs.map(input => ({
      path: input.path,
      description: `${input.path} 필드이다.`,
    }));
  }
}

/**
 * Bedrock provider 인스턴스 생성
 */
export function createBedrockProvider(model?: string, region?: string): BedrockProvider {
  return new BedrockProvider(model, region);
}
