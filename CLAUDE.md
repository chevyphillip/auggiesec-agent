# CLAUDE.md

## Project: OWASP GraphGuard

AI-powered security analysis agent for Node.js applications, aligned with OWASP Top 10 2021.

---

## Implementation Status

```
Phase 1: Skeleton Setup     [COMPLETE] ✓
Phase 2: Observability      [COMPLETE] ✓
Phase 3: LangGraph Agent    [COMPLETE] ✓
Phase 4: OWASP Analysis     [NEXT] <<<
Phase 5: CLI & Testing      [NOT STARTED]
```

**Current state**: LangGraph agent scaffold complete with SecurityAnalysisState, 5 nodes (input, enumerate, analyze, aggregate, output), full OpenTelemetry tracing integration, and 39 passing tests.

**Runtime**: Bun 1.x | TypeScript 5.x | ES Modules

**Full requirements**: See [docs/PRD.md](docs/PRD.md)

---

## Quick Start

Commands that work TODAY:

```bash
# Install dependencies
bun install

# Copy environment template and add your credentials
cp .env.example .env
# Edit .env with your Langfuse API keys

# Run the entrypoint (requires valid .env)
bun run dev

# Run tests
bun test

# Type check
bun run type-check
```

Commands that DO NOT work yet:

```bash
# bun run scan         # NOT IMPLEMENTED (Phase 5)
```

---

## Project Structure

```
auggiesec-agent/
├── index.ts                 [EXISTS]     Entry point (imports instrumentation first)
├── package.json             [EXISTS]     Dependencies + scripts
├── tsconfig.json            [EXISTS]     TypeScript config (Bun-optimized)
├── bun.lock                 [EXISTS]     Lockfile
├── .gitignore               [EXISTS]     Standard ignores
├── .env.example             [EXISTS]     Environment template
├── .env                     [TO CREATE]  Your local credentials (gitignored)
│
├── .github/
│   └── workflows/
│       └── test.yml         [EXISTS]     Bun test workflow
│
├── docs/
│   ├── PRD.md               [EXISTS]     Full requirements
│   └── PHASE1_PLAN.md       [EXISTS]     Phase 1 implementation plan
│
└── src/
    ├── instrumentation.ts   [EXISTS]     OpenTelemetry + Langfuse init
    ├── instrumentation.test.ts [EXISTS]  Instrumentation tests
    ├── config.ts            [EXISTS]     Config validation (Zod)
    ├── config.test.ts       [EXISTS]     Config tests
    │
    ├── graph/               [EXISTS]     Phase 3 - LangGraph agent scaffold
    │   ├── state.ts         [EXISTS]     SecurityAnalysisState + types
    │   ├── state.test.ts    [EXISTS]     State type tests
    │   ├── graph.test.ts    [EXISTS]     Graph execution tests
    │   ├── index.ts         [EXISTS]     Graph assembly + runSecurityAnalysis
    │   └── nodes/           [EXISTS]     Analysis nodes
    │       ├── index.ts                  Barrel export
    │       ├── input.ts                  Scan initialization
    │       ├── enumerate.ts              Target discovery (placeholder)
    │       ├── analyze.ts                Security analysis (placeholder)
    │       ├── aggregate.ts              Findings aggregation
    │       └── output.ts                 Scan finalization
    ├── tools/               [TO BUILD]   Phase 4 - LangChain tools (Auggie wrappers)
    ├── rules/               [TO BUILD]   Phase 4 - OWASP rule files (paraphrased)
    └── cli.ts               [TO BUILD]   Phase 5 - CLI entrypoint
```

---

## Configuration (12-Factor: Config)

All secrets and environment-specific values via environment variables. Never hardcode.

### .env.example Template

See [.env.example](.env.example) for the full template. Key variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `LANGFUSE_PUBLIC_KEY` | Yes (Phase 1+) | Starts with `pk-lf-` |
| `LANGFUSE_SECRET_KEY` | Yes (Phase 1+) | Starts with `sk-lf-` |
| `LANGFUSE_HOST` | No | Default: `https://cloud.langfuse.com` |
| `AUGMENT_API_KEY` | Yes (Phase 2+) | Starts with `aug_` |
| `ANTHROPIC_API_KEY` | Yes (Phase 2+) | Starts with `sk-ant-` |
| `NODE_ENV` | No | `development` / `production` / `test` |
| `LOG_LEVEL` | No | `debug` / `info` / `warn` / `error` |

### Config Validation Pattern (IMPLEMENTED)

See [src/config.ts](src/config.ts) for the full implementation. Key features:

- Zod schema validation with custom error messages
- Required fields: `langfuse.publicKey`, `langfuse.secretKey`
- Optional fields for Phase 2+: `augment.apiKey`, `llm.apiKey`
- Fail-fast: exits with code 1 on validation failure
- Type inference: `Config` type exported for use in application code

---

## 12-Factor Principles

This project follows the [12-Factor App methodology](https://12factor.net/) adapted for a CLI-first LLM agent.

### Core Factors (v1 Required)

| Factor | Principle | Status | Implementation |
|--------|-----------|--------|----------------|
| **I. Codebase** | One repo, many deploys | Done | Single git repo |
| **II. Dependencies** | Explicit declaration | Done | package.json with lockfile |
| **III. Config** | Environment variables | Done | .env + Zod validation |
| **XI. Logs** | Event streams (stdout) | Done | OpenTelemetry + Langfuse |

### Operational Factors (Lightweight for CLI)

| Factor | Principle | Application |
|--------|-----------|-------------|
| **V. Build/Release/Run** | Strict separation | Bun handles naturally |
| **VI. Processes** | Stateless | CLI invocations are stateless |
| **IX. Disposability** | Fast start, graceful stop | LangGraph supports checkpointing |
| **X. Dev/Prod Parity** | Minimize gaps | Same Bun runtime everywhere |

### Future-Ready Factors (Post-v1)

| Factor | When Needed | Notes |
|--------|-------------|-------|
| **VII. Port Binding** | HTTP endpoint | v1 is CLI-only (see Non-Goals) |
| **VIII. Concurrency** | Parallel workers | LangGraph supports parallel nodes |
| **XII. Admin Processes** | Migrations, cleanup | Define as npm scripts |

### Agent-Specific Factors (12-Factor Agents)

Adapted from [12-Factor Agents](https://github.com/humanlayer/12-factor-agents) for LLM applications:

| Principle | Description | Implementation |
|-----------|-------------|----------------|
| **Tool Validation** | Schema-validate tool I/O | Zod schemas for Auggie tools |
| **Prompt Ownership** | Prompts as versioned code | OWASP rules in src/rules/ |
| **Context Management** | Token budget awareness | LangGraph state windowing |
| **Deterministic Replay** | Reproducible debugging | Langfuse trace capture |
| **Graceful Degradation** | Handle LLM failures | LangGraph retry patterns |
| **Human Escalation** | Route critical decisions | Tool for human review |

---

## Observability Architecture (12-Factor: Logs)

**Critical**: Observability is foundational for agent auditability and debugging.

### Initialization Order

The `instrumentation.ts` file MUST be imported FIRST in the entrypoint:

```typescript
// index.ts - CORRECT ORDER
import './src/instrumentation';  // MUST BE FIRST
import { runScan } from './src/cli';
// ... rest of imports
```

### instrumentation.ts Pattern (IMPLEMENTED)

```typescript
// src/instrumentation.ts
import 'dotenv/config';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { LangfuseSpanProcessor } from '@langfuse/otel';  // Note: @langfuse/otel, not langfuse
import { trace } from '@opentelemetry/api';

// LangfuseSpanProcessor auto-reads LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY from env
const sdk = new NodeSDK({
  spanProcessors: [
    new LangfuseSpanProcessor({
      baseUrl: process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com',
    }),
  ],
});

sdk.start();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await sdk.shutdown();
});

// Export tracer for use in application code
export const tracer = trace.getTracer('graphguard', '0.1.0');
```

**Important:** Use `@langfuse/otel` package, not `langfuse` directly. The `LangfuseSpanProcessor` automatically reads credentials from environment variables.

### Trace Hierarchy

```
Run (top-level scan)
├── Node: enumerate_targets
│   └── Tool: auggie.searchCode
├── Node: analyze_injection
│   ├── Tool: auggie.getFileContent
│   └── LLM: anthropic.chat
├── Node: analyze_auth
│   └── ...
└── Node: aggregate_findings
```

### Required Span Attributes

| Attribute | Description | Example |
|-----------|-------------|---------|
| `scan.id` | Unique scan identifier | `scan_abc123` |
| `repo.path` | Target repository | `./nodejs-goof` |
| `owasp.category` | OWASP category being analyzed | `A03:2021-Injection` |
| `finding.severity` | Finding severity level | `critical` |

---

## Tech Stack Reference

Dependencies in package.json:

| Package | Version | Purpose | Status |
|---------|---------|---------|--------|
| `@langfuse/otel` | ^4.4.9 | OpenTelemetry span processor for Langfuse | **In Use** |
| `@opentelemetry/sdk-node` | ^0.208.0 | Distributed tracing SDK | **In Use** |
| `@opentelemetry/api` | ^1.9.0 | OpenTelemetry API | **In Use** |
| `langfuse` | ^3.38.6 | LLM observability backend | **In Use** |
| `zod` | ^3.24.0 | Schema validation | **In Use** |
| `dotenv` | ^16.4.7 | Environment variable loading | **In Use** |
| `@langchain/langgraph` | ^1.0.4 | Graph-based workflow orchestration | **In Use** |
| `@langchain/core` | ^1.1.4 | LLM abstractions and tools | **In Use** |
| `@langchain/anthropic` | ^1.2.3 | Anthropic model integration | Phase 4 |
| `langchain` | ^1.1.5 | Base LangChain utilities | Phase 4 |
| `@augmentcode/auggie-sdk` | ^0.1.9 | Code analysis and querying | Phase 4 |

---

## Implementation Roadmap

### Phase 1: Skeleton Setup [COMPLETE]

```
[x] bun init + TypeScript config
[x] package.json with all dependencies
[x] docs/PRD.md with full requirements
[x] .env.example template
[x] .gitignore configured for .env
```

### Phase 2: Observability Wiring [COMPLETE]

```
[x] Create src/instrumentation.ts with @langfuse/otel
[x] Update index.ts to import instrumentation FIRST
[x] Create src/config.ts with Zod validation
[x] Create test files (config.test.ts, instrumentation.test.ts)
[x] Add GitHub Actions workflow for tests
[ ] Verify traces appear in Langfuse dashboard (requires .env setup)
```

**Dependencies**: Langfuse account, API keys in .env

### Phase 3: LangGraph Agent Scaffold [COMPLETE]

```
[x] Create src/graph/state.ts (SecurityAnalysisState type with OWASP categories)
[x] Create minimal StateGraph with 5 nodes (input, enumerate, analyze, aggregate, output)
[x] Wire graph execution to instrumentation (all nodes traced)
[x] Add placeholder analysis node (mock findings for testing)
[x] Create comprehensive tests (state.test.ts, graph.test.ts)
[x] Export runSecurityAnalysis() function for programmatic use
```

**Key features**:
- `SecurityAnalysisStateAnnotation` with LangGraph Annotation pattern
- All 10 OWASP Top 10 2021 categories defined as typed constants
- `SecurityFinding` interface matching PRD Section 6.4
- Markdown summary generation in aggregate node
- Full OpenTelemetry span hierarchy for each node

**Dependencies**: Phase 2 complete

### Phase 4: Auggie + Tools Integration

```
[ ] Create src/tools/ with Auggie wrapper tools
[ ] Initialize Auggie client with workspaceRoot
[ ] Create OWASP rule files in src/rules/ (paraphrased)
[ ] Wire tools to LangGraph nodes
[ ] Implement per-category analysis nodes
```

**Dependencies**: Phase 3 complete, Augment account

### Phase 5: CLI & Testing

```
[ ] Create src/cli.ts with argument parsing
[ ] Add "scan" script to package.json
[ ] Implement JSON + Markdown output formatters
[ ] Clone nodejs-goof and run validation scans
[ ] Tune prompts based on findings accuracy
```

**Dependencies**: Phase 4 complete

---

## Output Formats

### Finding Schema

```typescript
interface SecurityFinding {
  category: string;        // "A03:2021-Injection"
  title: string;           // "SQL Injection in user query"
  severity: 'critical' | 'high' | 'medium' | 'low';
  evidence: {
    file: string;          // "routes/users.js"
    lineRange: string;     // "45-52"
    codeReference?: string; // Snippet hash or ID
  };
  explanation: string;     // Why this is vulnerable
  recommendedFix: string;  // How to remediate
}
```

See [docs/PRD.md](docs/PRD.md) Section 6.4 for full specification.

---

## Coding Patterns for Claude Code

### Pattern 1: File Creation Order

Always create files in this order when implementing:
1. `src/instrumentation.ts` (OpenTelemetry setup)
2. `src/config.ts` (config validation)
3. `src/graph/state.ts` (state types)
4. `src/tools/*.ts` (Auggie wrappers)
5. `src/graph/nodes/*.ts` (analysis nodes)
6. `src/graph/index.ts` (graph assembly)
7. `src/cli.ts` (entrypoint)

### Pattern 2: Tool Definition

```typescript
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

export const searchCodeTool = new DynamicStructuredTool({
  name: 'search_code',
  description: 'Search codebase for patterns or keywords',
  schema: z.object({
    query: z.string().describe('Search query'),
    filePattern: z.string().optional().describe('Glob pattern'),
  }),
  func: async ({ query, filePattern }) => {
    // Auggie SDK call here
    return JSON.stringify(results);
  },
});
```

### Pattern 3: LangGraph Node

```typescript
import { SecurityAnalysisState } from './state';

export async function analyzeInjectionNode(
  state: SecurityAnalysisState
): Promise<Partial<SecurityAnalysisState>> {
  // Analysis logic here
  const findings = await analyzeForInjection(state.targets);

  // Return partial state update
  return {
    findings: [...state.findings, ...findings],
    analyzedCategories: [...state.analyzedCategories, 'A03:2021-Injection'],
  };
}
```

### Pattern 4: Error Handling

```typescript
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('graphguard');

async function safeToolCall<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T | null> {
  const span = tracer.startSpan(`tool.${name}`);
  try {
    const result = await fn();
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
    span.recordException(error as Error);
    return null;
  } finally {
    span.end();
  }
}
```

---

## Non-Goals (v1)

Per [docs/PRD.md](docs/PRD.md) Section 2.2:

- No automatic remediation or PR generation
- No web UI (CLI only)
- No CI/CD or Git hosting integration
- No multi-repo or monorepo support
- No non-JavaScript/TypeScript targets

---

## References

### Internal

- [docs/PRD.md](docs/PRD.md) - Full product requirements

### External

- [Langfuse TS SDK v4](https://langfuse.com/docs/sdk/typescript) - Observability
- [LangGraph.js](https://langchain-ai.github.io/langgraphjs/) - Workflow orchestration
- [LangChain.js](https://js.langchain.com/) - LLM framework
- [Auggie SDK](https://docs.augmentcode.com/cli/sdk-typescript) - Code analysis
- [OWASP Top 10 2021](https://owasp.org/Top10/) - Security categories
- [12-Factor App](https://12factor.net/) - Application methodology
- [12-Factor Agents](https://github.com/humanlayer/12-factor-agents) - LLM agent patterns
- [nodejs-goof](https://github.com/snyk-labs/nodejs-goof) - Target vulnerable app
