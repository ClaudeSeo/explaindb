#!/usr/bin/env bun
import { parseOptions, resolveConfig } from './cli/options';
import { run, EXIT_CODES } from './cli/commands/run';
import { logger } from './cli/logger';

async function main(): Promise<void> {
  try {
    const options = parseOptions(process.argv);
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
