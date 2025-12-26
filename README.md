# ExplainDB - MongoDB Observed Schema CLI

A CLI tool that samples actual MongoDB documents to infer Observed Schema for each collection and generates readable Markdown documentation and JSON output.

## Overview

ExplainDB is a tool that analyzes and documents the actual document structure of schema-less MongoDB databases. It samples each collection to automatically infer field structures, type distributions, and data variants, then generates Markdown documents for team sharing and machine-readable JSON files.

### Core Values

- **Real Data-Based Inference**: Reverse-engineer schemas from actual data for undocumented or legacy databases
- **Mixed Type Detection**: Accurately identify type distributions per field and Optional fields
- **Schema Variant Analysis**: Detect various document shapes within the same collection to identify legacy data
- **Secure Data Masking**: Automatically mask sensitive information for safe sharing between teams
- **Deterministic Output**: Git-friendly consistent output for easy change tracking
- **LLM-Based Documentation**: Optionally leverage AI to auto-generate collection and field descriptions

## Key Features

### 1. Schema Inference and Documentation

- Infer field paths, presence ratios, and type distributions for each collection
- Represent Nested Objects and Array structures in dot notation (e.g., `user.profile.name`)
- Explore nested structures up to 20 levels deep (configurable)
- Automatically detect Optional fields (presence ratio < 100%)

### 2. Type Distribution Analysis

- Detect mixed-type fields and display the percentage of each type
- Analyze type distribution of elements inside arrays
- Provide masked example values for each type

### 3. Schema Variant Detection

- Extract Top N document shape variants within a collection
- Display the percentage of each variant and field differences (diff) compared to the baseline variant
- Useful for identifying legacy data or edge cases

### 4. Data Masking and Security

- Masking applied to all example values by default (e.g., `j***@e***.com`)
- Automatic detection and warning for suspected PII fields (email, phone, token, password, etc.)
- Original sensitive values are never exposed in any output file

### 5. Flexible Filtering and Sampling

- Collection include/exclude using glob patterns (e.g., `--include "user*"`, `--exclude "system.*"`)
- Time-based sampling to analyze only recent data
- Conditional sampling using MongoDB match filters
- Configurable sample size (default: 100)

### 6. LLM-Based Documentation (Optional)

- Auto-generate collection summaries and field descriptions using AWS Bedrock
- Safe LLM input: only aggregated summaries + masked examples are sent, not raw documents
- LLM cache support to minimize API calls on repeated runs

### 7. Incremental Mode

- Regenerate only changed collections to reduce execution time
- Option to automatically clean up deleted collections
- `--force` option for full regeneration

### 8. Output Formats

- `out/README.md`: Overall summary, collection list, sampling options, warnings
- `out/collections/<collection>.md`: Detailed field information for each collection
- `out/artifacts/schema.json`: Machine-readable schema data
- Index information included for each collection

## Installation

### Prerequisites

- Bun runtime installed
- MongoDB 4.0 or higher
- Read access to the MongoDB connection URI

### Install Dependencies

```bash
bun install
```

Main dependencies:

- `mongodb`: MongoDB connection and queries
- `commander`: CLI interface
- `zod`: Configuration validation
- `@aws-sdk/client-bedrock-runtime`: LLM integration (optional)

## Usage

### Basic Usage

```bash
bun src/index.ts run --uri mongodb://localhost:27017 --db mydb
```

### Using Environment Variables

You can configure settings in a `.env` file:

```env
EXPLAINDB_URI=mongodb://localhost:27017
EXPLAINDB_DB=mydb
```

After setting environment variables:

```bash
bun src/index.ts run
```

### CLI Options

#### Connection Settings

| Option        | Description            | Default                               |
| ------------- | ---------------------- | ------------------------------------- |
| `--uri <uri>` | MongoDB connection URI | Environment variable: `EXPLAINDB_URI` |
| `--db <db>`   | Target database name   | Environment variable: `EXPLAINDB_DB`  |

#### Output Settings

| Option        | Description      | Default |
| ------------- | ---------------- | ------- |
| `--out <dir>` | Output directory | `./out` |

#### Collection Filtering

| Option                | Description                          | Default |
| --------------------- | ------------------------------------ | ------- |
| `--include <pattern>` | Collection pattern to include (glob) | -       |
| `--exclude <pattern>` | Collection pattern to exclude (glob) | -       |

#### Sampling Settings

| Option                 | Description                               | Default |
| ---------------------- | ----------------------------------------- | ------- |
| `--sample-size <n>`    | Number of sample documents per collection | `100`   |
| `--time-field <field>` | Field name for time-based sampling        | -       |
| `--time-window <days>` | Time window (in days)                     | -       |
| `--match <json>`       | MongoDB match filter (JSON string)        | -       |
| `--sampling-strict`    | Throw error on sampling failure           | `false` |

#### Flattening Limits

| Option                   | Description               | Default |
| ------------------------ | ------------------------- | ------- |
| `--max-depth <n>`        | Maximum nesting depth     | `20`    |
| `--max-keys-per-doc <n>` | Maximum keys per document | `2000`  |
| `--max-array-sample <n>` | Maximum array sample size | `50`    |

#### Inference Settings

| Option                     | Description                         | Default |
| -------------------------- | ----------------------------------- | ------- |
| `--optional-threshold <n>` | Threshold ratio for Optional fields | `0.95`  |
| `--examples-per-type <n>`  | Number of examples per type         | `3`     |
| `--variant-top <n>`        | Display Top N variants              | `10`    |

#### Masking Settings

| Option                             | Description                                                   | Default    |
| ---------------------------------- | ------------------------------------------------------------- | ---------- |
| `--redact <all\|pii\|off>`         | Masking level (all: everything, pii: PII only, off: none)     | `pii`      |
| `--redact-mode <strict\|balanced>` | Masking mode                                                  | `balanced` |
| `--pii-patterns <patterns>`        | Custom PII patterns (comma-separated, e.g., kakao._,social._) | `-`        |

#### Performance Settings

| Option              | Description                            | Default |
| ------------------- | -------------------------------------- | ------- |
| `--concurrency <n>` | Concurrency level (DB scan, LLM calls) | `10`    |

#### LLM Settings

| Option                      | Description                       | Default   |
| --------------------------- | --------------------------------- | --------- |
| `--llm <on\|off>`           | Enable LLM documentation          | `off`     |
| `--llm-provider <provider>` | LLM provider                      | `bedrock` |
| `--llm-model <model>`       | LLM model name                    | -         |
| `--llm-region <region>`     | AWS region                        | -         |
| `--llm-cache <on\|off>`     | Enable LLM cache                  | `on`      |
| `--llm-max-fields <n>`      | Maximum fields for LLM processing | -         |

#### Incremental Mode Settings

| Option                                  | Description                  | Default |
| --------------------------------------- | ---------------------------- | ------- |
| `--incremental <on\|off>`               | Incremental mode             | `on`    |
| `--force`                               | Force full regeneration      | `false` |
| `--prune-removed-collections <on\|off>` | Clean up deleted collections | `on`    |

#### Logging Settings

| Option      | Description                                                | Default |
| ----------- | ---------------------------------------------------------- | ------- |
| `--verbose` | Enable verbose logging (includes field/sampling step logs) | -       |

### Usage Examples

#### 1. Analyze Specific Collections Only

```bash
bun src/index.ts run --uri mongodb://localhost:27017 --db mydb --include "user*"
```

#### 2. Exclude System Collections

```bash
bun src/index.ts run --exclude "system.*"
```

#### 3. Sample Only Last 7 Days of Data

```bash
bun src/index.ts run --sample-size 500 --time-field createdAt --time-window 7
```

#### 4. Analyze Only Documents with Specific Status

```bash
bun src/index.ts run --match '{"status": "active"}'
```

#### 5. Auto-Documentation with LLM

```bash
bun src/index.ts run --llm on --llm-model anthropic.claude-3-5-sonnet-20241022-v2:0 --llm-region us-west-2
```

#### 6. Full Regeneration with Verbose Logging

```bash
bun src/index.ts run --force --verbose
```

#### 7. Combining Multiple Options

```bash
bun src/index.ts run \
  --uri mongodb://localhost:27017 \
  --db mydb \
  --include "user*" \
  --exclude "*.backup" \
  --sample-size 200 \
  --max-depth 15 \
  --verbose
```

## Important Notes

### Performance Considerations

- Expected completion within 5 minutes for databases with 100+ collections
- Larger sample sizes enable more accurate inference but increase execution time
- Incremental mode regenerates only changed collections, reducing time

### Security Considerations

- Masking is enabled by default and is recommended to remain on
- When using LLM, only aggregated summaries and masked examples are sent, not raw documents
- Suspected PII fields are automatically flagged with warnings, but manually verify sensitive data

### Sampling Limitations

- The default sample size of 100 is adequate for most cases, but collections with highly diverse schemas may require larger samples
- Full document scanning is not supported; the tool operates on sampling only
- Empty collections are displayed as "Empty Collection" with a warning

### MongoDB Version

- Targets MongoDB version 4.0 and above
- Read access is required (write access not needed)

### Output Files

- Output files use UTF-8 encoding
- Generated deterministically for Git diff compatibility (sorting, normalization applied)
- Repeated runs with the same options produce identical content

### Error Handling

- Clear error messages with connection troubleshooting hints on MongoDB connection failure
- On LLM call failure, retries 3 times then generates schema without LLM descriptions (graceful degradation)
- Guidance on configuration when required options (`--uri`, `--db`) are missing

## Output Structure

```
out/
└── {db}/                           # Output directory per database
    ├── README.md                   # Overall summary, collection list
    ├── collections/
    │   ├── users.md               # Detailed documentation per collection
    │   └── ...
    └── artifacts/
        └── schema.json            # Machine-readable schema data
```

### README.md Contents

- Overall database overview
- Collection list with document counts
- Sampling options used
- Warnings and suspected PII field summary

### Collection Documents (collections/\*.md) Contents

- Collection metadata (document count, sample size)
- Field path list
- Presence ratio and type distribution for each field
- Masked example values per type
- Top N schema variants
- Index information

### schema.json Contents

- Complete schema data in JSON format
- Can be parsed and utilized by other tools or scripts

## License

MIT License
