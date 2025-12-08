# CLAUDE.md

## Project: OWASP GraphGuard

AI-powered security analysis agent for Node.js applications, aligned with OWASP Top 10 2021.

---

## Implementation Status

```
Phase 1: Skeleton Setup     [CURRENT] <<<
Phase 2: Observability      [NOT STARTED]
Phase 3: LangGraph Agent    [NOT STARTED]
Phase 4: OWASP Analysis     [NOT STARTED]
Phase 5: CLI & Testing      [NOT STARTED]
```

**Current state**: Project skeleton with dependencies declared but no implementation code.

**Runtime**: Bun 1.x | TypeScript 5.x | ES Modules

**Full requirements**: See [docs/PRD.md](docs/PRD.md)

---

## Quick Start

Commands that work TODAY:

```bash
# Install declared dependencies
bun install

# Run skeleton entrypoint (outputs "Hello via Bun!")
bun run index.ts
```

Commands that DO NOT work yet:

```bash
# bun run dev          # NOT IMPLEMENTED
# bun run scan         # NOT IMPLEMENTED
```

---

## Project Structure

```
auggiesec-agent/
├── index.ts                 [EXISTS]     Entry point (skeleton only)
├── package.json             [EXISTS]     Dependencies declared
├── tsconfig.json            [EXISTS]     TypeScript config (Bun-optimized)
├── bun.lock                 [EXISTS]     Lockfile
├── .gitignore               [EXISTS]     Standard ignores
├── docs/
│   └── PRD.md               [EXISTS]     Full requirements (292 lines)
│
├── .env                     [TO CREATE]  Environment variables
├── .env.example             [TO CREATE]  Template for .env
│
└── src/                     [TO BUILD]   Implementation code
    ├── instrumentation.ts               OpenTelemetry/Langfuse init
    ├── config.ts                        Config validation (Zod)
    ├── graph/
    │   ├── state.ts                     LangGraph state definition
    │   ├── nodes/                       Analysis nodes
    │   └── index.ts                     Graph assembly
    ├── tools/                           LangChain tools (Auggie wrappers)
    ├── rules/                           OWASP rule files (paraphrased)
    └── cli.ts                           CLI entrypoint
```

---

## Configuration (12-Factor: Config)

All secrets and environment-specific values via environment variables. Never hardcode.

### .env.example Template (TO CREATE)

```bash
# ============================================
# OWASP GraphGuard Configuration
# Copy to .env and fill in values
# ============================================

# --- Langfuse Observability ---
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_HOST=https://cloud.langfuse.com

# --- Augment / Auggie SDK ---
AUGMENT_API_KEY=aug_...

# --- LLM Provider (choose one) ---
ANTHROPIC_API_KEY=sk-ant-...
# OPENAI_API_KEY=sk-...

# --- Target Repository ---
WORKSPACE_ROOT=./nodejs-goof

# --- Application ---
NODE_ENV=development
LOG_LEVEL=debug
```

### Config Validation Pattern (TO IMPLEMENT)

```typescript
// src/config.ts
import { z } from 'zod';

const ConfigSchema = z.object({
  langfuse: z.object({
    publicKey: z.string().startsWith('pk-lf-'),
    secretKey: z.string().startsWith('sk-lf-'),
    host: z.string().url().default('https://cloud.langfuse.com'),
  }),
  augment: z.object({
    apiKey: z.string().startsWith('aug_'),
  }),
  llm: z.object({
    provider: z.enum(['anthropic', 'openai']).default('anthropic'),
    apiKey: z.string(),
  }),
  workspaceRoot: z.string().default('./nodejs-goof'),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
});

export function loadConfig() {
  const result = ConfigSchema.safeParse({
    langfuse: {
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      host: process.env.LANGFUSE_HOST,
    },
    augment: { apiKey: process.env.AUGMENT_API_KEY },
    llm: {
      provider: process.env.LLM_PROVIDER,
      apiKey: process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY,
    },
    workspaceRoot: process.env.WORKSPACE_ROOT,
    nodeEnv: process.env.NODE_ENV,
  });

  if (!result.success) {
    console.error('Configuration validation failed:', result.error.format());
    process.exit(1);
  }
  return result.data;
}
```

---

## 12-Factor Principles

This project follows the [12-Factor App methodology](https://12factor.net/) adapted for a CLI-first LLM agent.

### Core Factors (v1 Required)

| Factor | Principle | Status | Implementation |
|--------|-----------|--------|----------------|
| **I. Codebase** | One repo, many deploys | Done | Single git repo |
| **II. Dependencies** | Explicit declaration | Done | package.json with lockfile |
| **III. Config** | Environment variables | TO BUILD | .env + Zod validation |
| **XI. Logs** | Event streams (stdout) | TO BUILD | OpenTelemetry + Langfuse |

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

### instrumentation.ts Pattern (TO IMPLEMENT)

```typescript
// src/instrumentation.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { Langfuse, LangfuseSpanProcessor } from 'langfuse';

const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
  secretKey: process.env.LANGFUSE_SECRET_KEY!,
  baseUrl: process.env.LANGFUSE_HOST,
});

const sdk = new NodeSDK({
  spanProcessors: [new LangfuseSpanProcessor({ langfuse })],
});

sdk.start();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await langfuse.flushAsync();
  await sdk.shutdown();
});

export { langfuse };
```

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

Dependencies declared in package.json (status: declared but not yet used):

| Package | Version | Purpose | Status |
|---------|---------|---------|--------|
| `@langchain/langgraph` | ^1.0.4 | Graph-based workflow orchestration | Declared |
| `@langchain/core` | ^1.1.4 | LLM abstractions and tools | Declared |
| `@langchain/anthropic` | ^1.2.3 | Anthropic model integration | Declared |
| `langchain` | ^1.1.5 | Base LangChain utilities | Declared |
| `@augmentcode/auggie-sdk` | ^0.1.9 | Code analysis and querying | Declared |
| `@opentelemetry/sdk-node` | ^0.208.0 | Distributed tracing | Declared |
| `@opentelemetry/api` | ^1.9.0 | OpenTelemetry API | Declared |
| `langfuse` | ^3.38.6 | LLM observability backend | Declared |
| `zod` | ^3.24.0 | Schema validation | Declared |
| `dotenv` | ^16.4.7 | Environment variable loading | Declared |

---

## Implementation Roadmap

### Phase 1: Skeleton Setup [CURRENT]

```
[x] bun init + TypeScript config
[x] package.json with all dependencies
[x] docs/PRD.md with full requirements
[ ] .env.example template
[ ] .gitignore update for .env
```

### Phase 2: Observability Wiring [NEXT]

```
[ ] Create src/instrumentation.ts
[ ] Update index.ts to import instrumentation FIRST
[ ] Create src/config.ts with Zod validation
[ ] Create .env with Langfuse credentials
[ ] Verify traces appear in Langfuse dashboard
```

**Dependencies**: Langfuse account, API keys

### Phase 3: LangGraph Agent Scaffold

```
[ ] Create src/graph/state.ts (SecurityAnalysisState type)
[ ] Create minimal StateGraph with input/output nodes
[ ] Wire graph execution to instrumentation
[ ] Add placeholder analysis node
```

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
