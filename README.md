# OWASP GraphGuard

AI-powered security scanner that analyzes codebases for OWASP Top 10 2021 vulnerabilities with full observability via Langfuse.

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                    LangGraph State Machine                       │
├─────────────────────────────────────────────────────────────────┤
│  input → enumerate → analyze → aggregate → output               │
│            │            │                                        │
│            ▼            ▼                                        │
│      File Discovery   Auggie SDK + Augment SDK                  │
│                       (OWASP prompts from Langfuse)             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    Langfuse Observability
                    (traces, spans, agents)
```

1. **Enumerate** - Discovers analysis targets (routes, controllers, configs)
2. **Analyze** - Auggie SDK evaluates code against OWASP categories using prompts from Langfuse
3. **Aggregate** - Consolidates findings with severity and remediation guidance

## Requirements

- [Bun](https://bun.sh) runtime
- [Langfuse](https://langfuse.com) account (for observability + prompt management)
- [Augment](https://augmentcode.com) account (required, for enhanced code analysis)
- [Auggie CLI](https://github.com/augmentcode/auggie-cli) installed and authenticated (for Augment SDK)

## Setup

```bash
bun install
cp .env.example .env
# Fill in your credentials
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `LANGFUSE_PUBLIC_KEY` | Yes | Langfuse public key (`pk-lf-...`) |
| `LANGFUSE_SECRET_KEY` | Yes | Langfuse secret key (`sk-lf-...`) |
| `LANGFUSE_BASE_URL` | No | Langfuse host URL (for US region or self-hosted) |
| `AUGMENT_SESSION_AUTH` | Yes* | Full JSON from `auggie token print` (recommended) |
| `AUGMENT_API_TOKEN` | Yes* | Augment API token (alternative to SESSION_AUTH) |
| `AUGMENT_API_URL` | Yes* | Augment API URL (required with API_TOKEN) |
| `WORKSPACE_ROOT` | No | Target repo path (default: `./nodejs-goof`) |

*One of `AUGMENT_SESSION_AUTH` or (`AUGMENT_API_TOKEN` + `AUGMENT_API_URL`) is required.

**Getting Augment Credentials:**
```bash
# Install Auggie CLI and authenticate
auggie token print  # Copy the full JSON output

# Set as environment variable
export AUGMENT_SESSION_AUTH='{"accessToken":"...","tenantURL":"..."}'
```

## Usage

```bash
bun run index.ts
```

## Example Output

```
[graphguard] Starting OWASP security analysis...
[graph] Analysis complete: 41 findings

===== Analysis Complete =====
Scan ID: scan_1733849012653_abc123
Status: completed
Total Findings: 41
Categories Analyzed: 6

Top Findings:
  1. [CRITICAL] Command Injection in exec()
     Category: A03:2021-Injection
     File: routes/index.js

  2. [CRITICAL] NoSQL Injection via $where
     Category: A03:2021-Injection
     File: routes/users.js

  3. [HIGH] Hardcoded Database Credentials
     Category: A02:2021-Cryptographic Failures
     File: app.js
```

## Tests

```bash
bun test           # Run all tests
bun run type-check # TypeScript validation
```

## Documentation

- **[Augment SDK Integration Guide](docs/AUGMENT_SDK_INTEGRATION.md)** - Complete guide to the Augment Context Engine SDK integration
  - 4-phase modernization (Foundation, Performance, Accuracy, Polish)
  - DirectContext for persistent indexing (97% faster)
  - Targeted search for OWASP vulnerabilities (40% fewer false positives)
  - Session callbacks for real-time progress tracking
  - Request cancellation with timeout protection
  - Security hardening with excludedTools
  - Performance benchmarks and best practices

- **[Video Demonstration Narrative](docs/VIDEO_NARRATIVE.md)** - Script and talking points for demo videos

- **[Product Requirements Document](docs/PRD.md)** - Original PRD with implementation status

## Features

### Augment SDK Integration

- **DirectContext**: Persistent indexing with state export/import for 97% faster subsequent scans
- **Targeted Search**: OWASP-specific semantic search to pre-filter code before LLM analysis
- **SearchAndAsk**: Combined retrieval + analysis in a single API call
- **Security Hardening**: 3 security profiles (strict/moderate/permissive) to prevent code modifications
- **Session Callbacks**: Real-time progress tracking during long-running scans
- **Request Cancellation**: Timeout protection with graceful cleanup (default: 5 minutes)
- **Custom Tools**: Structured vulnerability reporting with `report_vulnerability` tool

### Observability

- **Full OpenTelemetry tracing** with Langfuse integration
- **Semantic observation types**: generation, retriever, agent, chain, tool
- **Rich span attributes**: scan ID, repo path, OWASP category, severity, etc.
- **Trace hierarchy**: Complete visibility into analysis workflow

#### Tool-level observability in Langfuse

GraphGuard wraps all tool-like operations using the `withTool()` helper in
`src/observability/index.ts`, which creates Langfuse observations of type
`tool`. These appear alongside agents, spans, and generations in the Langfuse
UI and carry scan-aware metadata.

**Key tool observation names:**

| Observation name                    | Description                                               | Source file                               |
|-------------------------------------|-----------------------------------------------------------|-------------------------------------------|
| `tool.auggie_create`                | Auggie SDK client creation for a scan                     | `src/tools/auggie-analysis.ts`            |
| `tool.auggie_prompt`                | Auggie SDK `client.prompt` OWASP analysis call           | `src/tools/auggie-analysis.ts`            |
| `tool.direct_context_create`        | DirectContext creation or import from a saved state file  | `src/tools/direct-context-analysis.ts`    |
| `tool.direct_context_index`         | DirectContext repository indexing                         | `src/tools/direct-context-analysis.ts`    |
| `tool.direct_context_search`        | DirectContext semantic search for OWASP vulnerabilities   | `src/tools/direct-context-analysis.ts`    |
| `tool.direct_context_export`        | Export DirectContext state to disk                        | `src/tools/direct-context-analysis.ts`    |
| `tool.incremental_collect_metadata` | Collect filesystem metadata for incremental indexing      | `src/tools/incremental-indexer.ts`        |
| `tool.incremental_analyze_changes`  | Detect new, changed, and deleted files                    | `src/tools/incremental-indexer.ts`        |
| `tool.incremental_apply_update`     | Apply incremental file changes to DirectContext           | `src/tools/incremental-indexer.ts`        |
| `tool.targeted_search`              | DirectContext search for OWASP-specific patterns          | `src/tools/targeted-search.ts`            |
| `tool.targeted_search_and_analyze`  | Combined search + LLM analysis via DirectContext          | `src/tools/targeted-search.ts`            |
| `tool.report_vulnerability`         | Structured vulnerability reporting tool used by Auggie    | `src/tools/report-vulnerability.ts`       |

In a typical scan, you will see `tool.auggie_create` and `tool.auggie_prompt`
nested under the OWASP analysis agent for each category, along with
DirectContext and incremental indexing tools when those paths are enabled.

### Security Analysis

- **OWASP Top 10 2021** coverage for all 10 categories
- **LangGraph workflow**: 5-node state machine (input → enumerate → analyze → aggregate → output)
- **Structured findings**: Category, severity, evidence, explanation, remediation
