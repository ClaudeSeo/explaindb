#!/usr/bin/env bun
import { parseOptions, resolveConfig, getCommand } from './cli/options';
import { run, EXIT_CODES } from './cli/commands/run';
import { logger } from './cli/logger';

async function main(): Promise<void> {
  const argv = process.argv;
  const command = getCommand(argv);

  if (command === 'help' || command === '--help' || command === '-h') {
    console.log(`
ExplainDB - MongoDB Observed Schema CLI

Usage:
  explaindb run [options]    스키마 문서 생성

Options:
  --uri <uri>                MongoDB 연결 URI (env: EXPLAINDB_URI)
  --db <db>                  대상 데이터베이스 이름 (env: EXPLAINDB_DB)
  --out <dir>                출력 디렉토리 (default: ./out)
  --include <pattern>        포함할 컬렉션 패턴 (glob)
  --exclude <pattern>        제외할 컬렉션 패턴 (glob)
  --sample-size <n>          컬렉션당 샘플 문서 수 (default: 100)
  --time-field <field>       시간 기반 샘플링 필드
  --time-window <days>       시간 윈도우 (일)
  --match <json>             MongoDB match 필터 (JSON)
  --max-depth <n>            최대 중첩 깊이 (default: 20)
  --redact <on|off>          마스킹 활성화 (default: on)
  --verbose                  상세 로깅

Examples:
  explaindb run --uri mongodb://localhost:27017 --db mydb
  explaindb run --include "user*" --exclude "system.*"
  explaindb run --sample-size 500 --time-field createdAt --time-window 7
`);
    process.exit(0);
  }

  if (command !== 'run') {
    console.log(`Unknown command: ${command}`);
    console.log(`Run 'explaindb --help' for usage information.`);
    process.exit(EXIT_CODES.INVALID_ARGS);
  }

  try {
    const options = parseOptions(argv);
    const config = resolveConfig(options);
    const exitCode = await run(config);
    process.exit(exitCode);
  } catch (error) {
    const err = error as Error;

    if (err.message.includes('필수 옵션 누락')) {
      logger.error(err.message);
      process.exit(EXIT_CODES.INVALID_ARGS);
    }

    logger.error(`Error: ${err.message}`);
    process.exit(EXIT_CODES.RENDER_FAILURE);
  }
}

main();
