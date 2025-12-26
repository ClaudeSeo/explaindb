import { Command } from "commander";
import {
  CLIOptionsSchema,
  ENV_VARS,
  type CLIOptions,
  type ResolvedConfig,
} from "../types/config";

// 옵션 파싱 헬퍼 함수
function parseIntOption(value: string | undefined): number | undefined {
  return value ? parseInt(value, 10) : undefined;
}

function parseFloatOption(value: string | undefined): number | undefined {
  return value ? parseFloat(value) : undefined;
}

/**
 * CLI 옵션 파싱 및 환경변수 병합
 */
export function parseOptions(argv: string[]): CLIOptions {
  const program = new Command();

  program
    .name("explaindb")
    .description(
      "MongoDB Observed Schema CLI - 실제 문서를 샘플링하여 스키마를 추론하고 문서화합니다"
    )
    .version("1.0.0");

  program
    .command("run")
    .description("스키마 문서 생성")
    // 연결 설정
    .option("--uri <uri>", "MongoDB 연결 URI")
    .option("--db <db>", "대상 데이터베이스 이름")
    // 출력 설정
    .option("--out <dir>", "출력 디렉토리", "./out")
    // 컬렉션 필터링
    .option("--include <pattern>", "포함할 컬렉션 패턴 (glob)")
    .option("--exclude <pattern>", "제외할 컬렉션 패턴 (glob)")
    // 샘플링 설정
    .option("--sample-size <n>", "컬렉션당 샘플 문서 수", "100")
    .option("--time-field <field>", "시간 기반 샘플링 필드")
    .option("--time-window <days>", "시간 윈도우 (일)")
    .option("--match <json>", "MongoDB match 필터 (JSON)")
    .option("--sampling-strict", "샘플링 실패 시 에러 발생", false)
    // 평탄화 제한
    .option("--max-depth <n>", "최대 중첩 깊이", "20")
    .option("--max-keys-per-doc <n>", "문서당 최대 키 수", "2000")
    .option("--max-array-sample <n>", "배열 샘플 최대 수", "50")
    // 추론 설정
    .option("--optional-threshold <n>", "Optional 필드 기준 비율", "0.95")
    .option("--examples-per-type <n>", "타입당 예시 수", "3")
    .option("--variant-top <n>", "Top N 변종 표시", "10")
    // 마스킹 설정
    .option("--redact <all|pii|off>", "마스킹 레벨 (all: 전부, pii: PII만, off: 없음)", "pii")
    .option("--redact-mode <strict|balanced>", "마스킹 모드", "balanced")
    .option("--pii-patterns <patterns>", "커스텀 PII 패턴 (쉼표 구분, 예: kakao.*,social.*)")
    // LLM 설정
    .option("--llm <on|off>", "LLM 문서화 활성화", "off")
    .option("--llm-provider <provider>", "LLM 프로바이더", "bedrock")
    .option("--llm-model <model>", "LLM 모델")
    .option("--llm-region <region>", "LLM 리전")
    .option("--llm-cache <on|off>", "LLM 캐시 활성화", "on")
    .option("--llm-max-fields <n>", "LLM 처리 최대 필드 수")
    // 동시성 설정
    .option("--concurrency <n>", "동시 처리 수 (DB 스캔, LLM 호출)", "5")
    // 증분 모드 설정
    .option("--incremental <on|off>", "증분 모드", "on")
    .option("--force", "전체 재생성 강제", false)
    .option("--prune-removed-collections <on|off>", "삭제된 컬렉션 정리", "on")
    // 로깅 설정
    .option("--verbose", "상세 로깅", false);

  program.parse(argv);

  const cmd = program.commands.find((c) => c.name() === "run");
  if (!cmd) {
    return CLIOptionsSchema.parse({});
  }

  const opts = cmd.opts();

  // 문자열 숫자를 실제 숫자로 변환
  const rawOptions = {
    uri: opts.uri,
    db: opts.db,
    out: opts.out,
    include: opts.include,
    exclude: opts.exclude,
    sampleSize: parseIntOption(opts.sampleSize),
    timeField: opts.timeField,
    timeWindowDays: parseIntOption(opts.timeWindow),
    match: opts.match,
    samplingStrict: opts.samplingStrict,
    maxDepth: parseIntOption(opts.maxDepth),
    maxKeysPerDoc: parseIntOption(opts.maxKeysPerDoc),
    maxArraySample: parseIntOption(opts.maxArraySample),
    optionalThreshold: parseFloatOption(opts.optionalThreshold),
    examplesPerType: parseIntOption(opts.examplesPerType),
    variantTop: parseIntOption(opts.variantTop),
    redact: opts.redact,
    redactMode: opts.redactMode,
    piiPatterns: opts.piiPatterns ? opts.piiPatterns.split(",").map((p: string) => p.trim()) : undefined,
    llm: opts.llm,
    llmProvider: opts.llmProvider,
    llmModel: opts.llmModel,
    llmRegion: opts.llmRegion,
    llmCache: opts.llmCache,
    llmMaxFields: parseIntOption(opts.llmMaxFields),
    concurrency: parseIntOption(opts.concurrency),
    incremental: opts.incremental,
    force: opts.force,
    pruneRemovedCollections: opts.pruneRemovedCollections,
    verbose: opts.verbose,
  };

  // undefined 값 제거
  const filteredOptions = Object.fromEntries(
    Object.entries(rawOptions).filter(([, v]) => v !== undefined)
  );

  return CLIOptionsSchema.parse(filteredOptions);
}

/**
 * CLI 옵션과 환경변수를 병합하여 설정 해결
 * CLI 인자가 환경변수보다 우선순위가 높음
 */
export function resolveConfig(options: CLIOptions): ResolvedConfig {
  const uri = options.uri || process.env[ENV_VARS.URI];
  const db = options.db || process.env[ENV_VARS.DB];

  if (!uri) {
    throw new Error(
      `필수 옵션 누락: --uri 또는 환경변수 ${ENV_VARS.URI}를 설정하세요.`
    );
  }

  if (!db) {
    throw new Error(
      `필수 옵션 누락: --db 또는 환경변수 ${ENV_VARS.DB}를 설정하세요.`
    );
  }

  return {
    ...options,
    uri,
    db,
  };
}

/**
 * CLI 커맨드 가져오기 (run, help 등)
 * commander 대신 직접 argv 파싱
 */
export function getCommand(argv: string[]): string {
  // argv: [bun, script.ts, command, ...options]
  const args = argv.slice(2);

  // 첫 번째 인자가 옵션이 아니면 커맨드로 인식
  if (args.length > 0 && !args[0].startsWith("-")) {
    return args[0];
  }

  return "help";
}
