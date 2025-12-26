# ExplainDB - MongoDB Observed Schema CLI

A CLI tool that samples actual MongoDB documents to infer schemas and generate Markdown/JSON documentation.

## Tech Stack

- **Runtime**: Bun
- **Language**: TypeScript (strict mode)
- **Database**: MongoDB 7.x
- **CLI**: Commander
- **Validation**: Zod
- **LLM**: AWS Bedrock (optional)

## Commands

```bash
bun install              # Install dependencies
bun start                # Run CLI (= bun src/index.ts run)
bun test                 # Run tests
bun run lint             # Run ESLint
bun run lint:fix         # Auto-fix ESLint issues
```

## Project Structure

```
src/
├── adapters/            # External system integrations
│   ├── mongo/           # MongoDB client, scanner, sampler
│   └── llm/             # LLM provider (Bedrock)
├── cli/                 # CLI interface
│   ├── commands/        # run command
│   ├── options.ts       # CLI option parsing
│   └── logger.ts        # Masking-aware logger
├── core/                # Core business logic
│   ├── flatten/         # Document flattening
│   ├── infer/           # Type inference, aggregation
│   ├── redact/          # PII detection, masking
│   ├── variants/        # Schema variant analysis
│   └── explain/         # LLM documentation
├── render/              # Output rendering
│   ├── markdown/        # README.md, collection.md
│   └── json/            # schema.json
├── types/               # Type definitions (BSON, Config, Schema)
└── utils/               # Utilities (hash, sort)

tests/
├── unit/core/           # Core logic unit tests
├── unit/render/         # Renderer unit tests
└── integration/         # CLI, MongoDB integration tests
```

## Coding Conventions

- **Comments**: Korean (technical terms in English allowed)
- **Code**: English (variables, functions, type names)
- **Naming**: lowerCamelCase (functions), UPPER_CASE (constants), PascalCase (types)
- **Functions**: ≤15 lines, early return pattern
- **Magic numbers**: Extract to named constants
- **Export**: Use index.ts barrel exports

## Testing

```bash
bun test                 # Run all tests
bun test tests/unit      # Run unit tests only
```

- Framework: `bun:test`
- Test files: `*.test.ts`
- Current coverage: 115 pass, 7 skip

## Environment Variables

```env
EXPLAINDB_URI=mongodb://localhost:27017
EXPLAINDB_DB=mydb
```

## Bun Usage Rules

- Do not use `node` instead of `bun <file>`
- Do not use `jest`/`vitest` instead of `bun test`
- Do not use `npm`/`yarn` instead of `bun install`
- `.env` is auto-loaded (dotenv not required)

## Important Notes

- All example values are masked by default
- Automatic PII field detection and warnings
- Deterministic output (Git diff compatible)
- Only masked data is sent to LLM
