# ExplainDB - MongoDB Observed Schema CLI

A CLI tool that samples MongoDB documents to infer schema and generate Markdown/JSON documentation.

## Features

- **Schema Inference**: Infer field paths, types, and presence ratios from sampled documents
- **Type Distribution**: Detect mixed types and analyze array element types
- **Variant Detection**: Identify different document shapes within collections
- **Data Masking**: Automatic PII detection and masking (email, phone, etc.)
- **LLM Documentation**: Optional AI-generated descriptions via AWS Bedrock
- **Incremental Mode**: Regenerate only changed collections

## Quick Start

```bash
# 1. Install
bun install

# 2. Run
bun src/index.ts run --uri mongodb://localhost:27017 --db mydb

# 3. View output
open out/mydb/README.md
```

## Installation

### Prerequisites

- Bun runtime
- MongoDB 4.0+
- Read access to MongoDB

### Install

```bash
bun install
```

## Usage

### Environment Variables

```env
EXPLAINDB_URI=mongodb://localhost:27017
EXPLAINDB_DB=mydb
```

### Examples

```bash
# Filter collections
bun src/index.ts run --include "user*" --exclude "*.backup"

# Time-based sampling (last 7 days)
bun src/index.ts run --time-field createdAt --time-window 7

# Enable LLM documentation
bun src/index.ts run --llm on --llm-model anthropic.claude-3-5-sonnet-20241022-v2:0 --llm-region us-west-2
```

## CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `--uri` | MongoDB connection URI | env: `EXPLAINDB_URI` |
| `--db` | Database name | env: `EXPLAINDB_DB` |
| `--out` | Output directory | `./out` |
| `--sample-size` | Documents per collection | `100` |
| `--include` / `--exclude` | Collection filter (glob) | - |
| `--llm` | Enable LLM documentation (`on`/`off`) | `off` |
| `--force` | Force full regeneration | `false` |
| `--verbose` | Verbose logging | `false` |

See `bun src/index.ts run --help` for all options.

## Output

```
out/{db}/
├── README.md                   # Summary, collection list
├── collections/
│   └── {collection}.md        # Field schema per collection
└── artifacts/
    └── schema.json            # Machine-readable schema
```

### Generated README.md

```markdown
# Schema Documentation

Generated: 2025-12-26T09:44:25.244+09:00
Database: mydb
Collections: 12

## Collections

| Collection | Documents | Fields | Variants | Warnings     |
|------------|-----------|--------|----------|--------------|
| users      | ~1,000    | 15     | 2        | PII detected |
| orders     | ~5,000    | 23     | 3        | -            |
```

### Collection Document (collections/users.md)

| Path          | Present% | Types    | Optional | Examples         |
|---------------|----------|----------|----------|------------------|
| _id           | 100%     | ObjectId | No       | `507f1f77bc...`  |
| email         | 100%     | String   | No       | `j***@e***.com`  |
| profile.name  | 95%      | String   | Yes      | `J*** D**`       |
| profile.phone | 80%      | String   | Yes      | `010-****-5678`  |

### schema.json

```json
{
  "meta": {
    "generatedAt": "2025-12-26T09:44:25.244+09:00",
    "database": "mydb",
    "sampling": { "strategy": "random", "size": 100 }
  },
  "collections": {
    "users": {
      "estimatedCount": 1000,
      "sampledCount": 100,
      "fields": [
        {
          "path": "_id",
          "presentRatio": 1.0,
          "typeRatio": { "ObjectId": 1.0 },
          "optional": false
        }
      ],
      "variants": [],
      "warnings": ["PII detected: email, phone"]
    }
  }
}
```

## Notes

### Security
- Masking enabled by default (`--redact pii`)
- Only aggregated summaries and masked examples sent to LLM
- Automatic PII field detection with warnings

### Performance
- ~5 min for 100+ collections
- Incremental mode regenerates only changed collections
- Configurable concurrency (`--concurrency`)

### Sampling
- Default sample size: 100 documents per collection
- Time-based and filter-based sampling supported
- Empty collections displayed with warning

### Output
- UTF-8 encoded, deterministic for Git diff compatibility
- Repeated runs with same options produce identical content

## License

MIT License
