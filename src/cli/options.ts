import { Command } from "commander";
import {
  CLIOptionsSchema,
  ENV_VARS,
  type CLIOptions,
  type ResolvedConfig,
} from "../types/config";
import pkg from "../../package.json";

function parseIntOption(value: string | undefined): number | undefined {
  return value ? parseInt(value, 10) : undefined;
}

function parseFloatOption(value: string | undefined): number | undefined {
  return value ? parseFloat(value) : undefined;
}

/**
 * Parse CLI options and merge with environment variables
 */
export function parseOptions(argv: string[]): CLIOptions {
  const program = new Command();

  program
    .name("explaindb")
    .description(
      "Sample MongoDB documents to infer schema and generate documentation"
    )
    .version(pkg.version)
    .showHelpAfterError(true);

  program
    .command("run", { isDefault: true })
    .description("Generate schema documentation")
    .option("--uri <uri>", "MongoDB connection URI")
    .option("--db <db>", "Target database name")
    .option("--out <dir>", "Output directory", "./out")
    .option("--include <pattern>", "Collection pattern to include (glob)")
    .option("--exclude <pattern>", "Collection pattern to exclude (glob)")
    .option("--sample-size <n>", "Sample documents per collection", "100")
    .option("--time-field <field>", "Field for time-based sampling")
    .option("--time-window <days>", "Time window in days")
    .option("--match <json>", "MongoDB match filter (JSON)")
    .option("--sampling-strict", "Throw error on sampling failure", false)
    .option("--max-depth <n>", "Maximum nesting depth", "20")
    .option("--max-keys-per-doc <n>", "Maximum keys per document", "2000")
    .option("--max-array-sample <n>", "Maximum array elements to sample", "50")
    .option("--optional-threshold <n>", "Threshold ratio for optional fields", "0.95")
    .option("--examples-per-type <n>", "Examples per type", "3")
    .option("--variant-top <n>", "Show top N variants", "10")
    .option("--redact <all|pii|off>", "Redaction level (all/pii/off)", "pii")
    .option("--redact-mode <strict|balanced>", "Redaction mode", "balanced")
    .option("--pii-patterns <patterns>", "Custom PII patterns (comma-separated)")
    .option("--llm <on|off>", "Enable LLM documentation", "off")
    .option("--llm-provider <provider>", "LLM provider", "bedrock")
    .option("--llm-model <model>", "LLM model")
    .option("--llm-region <region>", "LLM region")
    .option("--llm-cache <on|off>", "Enable LLM cache", "on")
    .option("--llm-max-fields <n>", "Maximum fields for LLM processing")
    .option("--concurrency <n>", "Concurrency level", "5")
    .option("--incremental <on|off>", "Incremental mode", "on")
    .option("--force", "Force full regeneration", false)
    .option("--prune-removed-collections <on|off>", "Prune removed collections", "on")
    .option("--verbose", "Verbose logging", false);

  program.parse(argv);

  const cmd = program.commands.find((c) => c.name() === "run");
  if (!cmd) {
    return CLIOptionsSchema.parse({});
  }

  const opts = cmd.opts();

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

  const filteredOptions = Object.fromEntries(
    Object.entries(rawOptions).filter(([, v]) => v !== undefined)
  );

  return CLIOptionsSchema.parse(filteredOptions);
}

/**
 * Resolve config by merging CLI options with environment variables.
 * CLI arguments take precedence over environment variables.
 */
export function resolveConfig(options: CLIOptions): ResolvedConfig {
  const uri = options.uri || process.env[ENV_VARS.URI];
  const db = options.db || process.env[ENV_VARS.DB];

  if (!uri) {
    throw new Error(
      `Missing required option: --uri or env ${ENV_VARS.URI}`
    );
  }

  if (!db) {
    throw new Error(
      `Missing required option: --db or env ${ENV_VARS.DB}`
    );
  }

  return {
    ...options,
    uri,
    db,
  };
}
