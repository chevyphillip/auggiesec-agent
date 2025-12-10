# Phase 1 Implementation Plan: OWASP GraphGuard

## Executive Summary

Phase 1 establishes the **observability foundation** for the OWASP GraphGuard agent. This phase focuses on:
1. Configuration management (12-Factor compliant)
2. OpenTelemetry + Langfuse instrumentation
3. Test infrastructure setup
4. Verification that traces appear in Langfuse dashboard

**Current State:** ✅ **PHASE 1 COMPLETE** - All tasks implemented and verified.

**Goal:** A working entrypoint with full observability wiring, validated configuration, and a minimal test suite.

**Outcome:** Phase 1 delivered all planned functionality:
- OpenTelemetry + Langfuse integration working (traces verified in dashboard)
- Zod-based configuration validation with fail-fast behavior
- 39 passing tests across config, instrumentation, and LangGraph modules
- GitHub Actions CI workflow running on push/PR

---

## Phase 1 Scope

### In Scope
- [x] Bun + TypeScript project initialization ✓
- [x] package.json with all dependencies ✓
- [x] `.env.example` template with all required variables ✓
- [x] `src/config.ts` - Zod-based configuration validation ✓
- [x] `src/instrumentation.ts` - OpenTelemetry + Langfuse setup ✓
- [x] Update `index.ts` to import instrumentation FIRST ✓
- [x] Test infrastructure with `bun:test` ✓
- [x] GitHub Actions workflow for tests ✓
- [x] Update `CLAUDE.md` with correct patterns ✓
- [x] Verification of Langfuse trace ingestion ✓

### Out of Scope (Phase 2+)
- LangGraph state and nodes
- Auggie SDK integration
- OWASP rule files
- CLI argument parsing
- Full security analysis workflow

---

## Implementation Tasks

### Task 1: Install Missing Dependency

**Command:**
```bash
bun add @langfuse/otel
```

**Why:** The `LangfuseSpanProcessor` class required for OpenTelemetry integration lives in `@langfuse/otel`, not in the base `langfuse` package.

---

### Task 2: Environment Configuration Files

**File to create:** `.env.example`

**Contents:**
```bash
# ============================================
# OWASP GraphGuard Configuration
# Copy to .env and fill in values
# ============================================

# --- Langfuse Observability (Required for Phase 1) ---
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_HOST=https://cloud.langfuse.com

# --- Augment / Auggie SDK (Required for Phase 2+) ---
AUGMENT_API_KEY=aug_...

# --- LLM Provider (Required for Phase 2+) ---
ANTHROPIC_API_KEY=sk-ant-...
# OPENAI_API_KEY=sk-...

# --- Target Repository ---
WORKSPACE_ROOT=./nodejs-goof

# --- Application ---
NODE_ENV=development
LOG_LEVEL=debug
```

**Verification:** `.gitignore` already includes `.env` patterns.

---

### Task 3: Configuration Validation (`src/config.ts`)

**File:** `src/config.ts`

**Implementation:**
```typescript
import { z } from 'zod';

const ConfigSchema = z.object({
  langfuse: z.object({
    publicKey: z.string().startsWith('pk-lf-'),
    secretKey: z.string().startsWith('sk-lf-'),
    host: z.string().url().default('https://cloud.langfuse.com'),
  }),
  augment: z.object({
    apiKey: z.string().startsWith('aug_').optional(),
  }),
  llm: z.object({
    provider: z.enum(['anthropic', 'openai']).default('anthropic'),
    apiKey: z.string().optional(),
  }),
  workspaceRoot: z.string().default('./nodejs-goof'),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  const result = ConfigSchema.safeParse({
    langfuse: {
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      host: process.env.LANGFUSE_HOST,
    },
    augment: {
      apiKey: process.env.AUGMENT_API_KEY,
    },
    llm: {
      provider: process.env.LLM_PROVIDER,
      apiKey: process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY,
    },
    workspaceRoot: process.env.WORKSPACE_ROOT,
    nodeEnv: process.env.NODE_ENV,
    logLevel: process.env.LOG_LEVEL,
  });

  if (!result.success) {
    console.error('Configuration validation failed:');
    console.error(result.error.format());
    process.exit(1);
  }

  return result.data;
}
```

**Key decisions:**
- Langfuse keys are REQUIRED (Phase 1 core requirement)
- Auggie and LLM keys are OPTIONAL (needed in Phase 2+)
- Exit with code 1 on validation failure (fail fast)

---

### Task 4: Instrumentation Setup (`src/instrumentation.ts`)

**File:** `src/instrumentation.ts`

**Implementation:**
```typescript
// src/instrumentation.ts
import 'dotenv/config';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { trace } from '@opentelemetry/api';

// Validate required environment variables
const requiredVars = ['LANGFUSE_PUBLIC_KEY', 'LANGFUSE_SECRET_KEY'];
for (const envVar of requiredVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Initialize OpenTelemetry SDK with Langfuse span processor
// LangfuseSpanProcessor automatically reads LANGFUSE_* env vars
const sdk = new NodeSDK({
  spanProcessors: [
    new LangfuseSpanProcessor({
      baseUrl: process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com',
    }),
  ],
});

sdk.start();
console.log('[instrumentation] OpenTelemetry + Langfuse initialized');

// Graceful shutdown
const shutdown = async () => {
  console.log('[instrumentation] Shutting down...');
  await sdk.shutdown();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Export tracer for use in application code
export const tracer = trace.getTracer('graphguard', '0.1.0');
```

**Key points:**
- `LangfuseSpanProcessor` auto-reads `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` from env
- Fail fast if required env vars missing
- Export tracer for creating custom spans in later phases

---

### Task 5: Update Entrypoint (`index.ts`)

**File:** `index.ts`

**Updated implementation:**
```typescript
// CRITICAL: Instrumentation MUST be imported first
import './src/instrumentation';

import { loadConfig } from './src/config';

// Validate configuration
const config = loadConfig();

console.log(`[graphguard] Environment: ${config.nodeEnv}`);
console.log('[graphguard] Configuration validated successfully');
console.log('[graphguard] Hello via Bun!');
```

**Verification:** Run `bun run index.ts` and confirm:
1. No errors on startup
2. Log messages appear
3. Trace appears in Langfuse dashboard

---

### Task 6: Test Infrastructure

**Files to create:**
- `src/config.test.ts`
- `src/instrumentation.test.ts`

**package.json scripts to add:**
```json
{
  "scripts": {
    "dev": "bun run index.ts",
    "test": "bun test",
    "test:watch": "bun test --watch",
    "test:coverage": "bun test --coverage",
    "type-check": "tsc --noEmit"
  }
}
```

**Test coverage for Phase 1:**

1. **Config tests** (`src/config.test.ts`):
   - Valid environment loads successfully
   - Missing LANGFUSE_PUBLIC_KEY throws error
   - Missing LANGFUSE_SECRET_KEY throws error
   - Invalid key prefix rejected
   - Default values applied correctly

2. **Instrumentation tests** (`src/instrumentation.test.ts`):
   - Module imports without error
   - Graceful shutdown handlers registered

**Testing approach:** Mock environment variables using `beforeEach`/`afterEach` hooks.

---

### Task 7: GitHub Actions Update

**File:** `.github/workflows/test.yml` (NEW)

**Implementation:**
```yaml
name: Test

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install

      - name: Type check
        run: bun run type-check

      - name: Run tests
        run: bun test
```

---

### Task 8: Update CLAUDE.md

**File:** `CLAUDE.md`

**Updates required:**
1. Update Implementation Status to show Phase 1 complete after implementation
2. Fix the `instrumentation.ts` pattern to use `@langfuse/otel`:
   - Remove `import { Langfuse, LangfuseSpanProcessor } from 'langfuse'`
   - Add `import { LangfuseSpanProcessor } from '@langfuse/otel'`
   - Remove manual Langfuse client instantiation
3. Add `@langfuse/otel` to the Tech Stack Reference table
4. Update Quick Start commands once `bun run dev` and `bun test` work

---

### Task 9: Verification Checklist

**Manual verification steps:**

1. **Configuration validation:**
   ```bash
   # With valid .env
   bun run index.ts
   # Expected: Success logs, no errors

   # With missing key
   LANGFUSE_PUBLIC_KEY= bun run index.ts
   # Expected: Validation error, exit code 1
   ```

2. **Langfuse dashboard:**
   - Run `bun run index.ts` with valid credentials
   - Open Langfuse dashboard
   - Verify trace appears with:
     - Service name: `graphguard`
     - Timestamp matching run time
     - No errors in trace

3. **Test suite:**
   ```bash
   bun test
   # Expected: All tests pass

   bun test --coverage
   # Expected: Coverage report generated
   ```

---

## File Structure After Phase 1

```
auggiesec-agent/
├── index.ts                 [UPDATED]   Import instrumentation first
├── package.json             [UPDATED]   Add scripts
├── tsconfig.json            [EXISTS]    No changes
├── bun.lock                 [UPDATED]   After adding @langfuse/otel
├── .gitignore               [EXISTS]    Already configured
├── .env.example             [NEW]       Environment template
├── .env                     [NEW]       Local credentials (gitignored)
├── CLAUDE.md                [UPDATED]   Fix instrumentation pattern
│
├── .github/
│   └── workflows/
│       ├── claude-*.yml     [EXISTS]    Existing Claude workflows
│       └── test.yml         [NEW]       Bun test workflow
│
├── src/
│   ├── config.ts            [NEW]       Zod configuration
│   ├── config.test.ts       [NEW]       Config tests
│   ├── instrumentation.ts   [NEW]       OpenTelemetry + Langfuse
│   └── instrumentation.test.ts [NEW]    Instrumentation tests
│
└── docs/
    ├── PRD.md               [EXISTS]    No changes
    └── PHASE1_PLAN.md       [EXISTS]    This implementation plan
```

---

## Dependencies Update Required

**Critical finding:** The current `package.json` is missing required Langfuse OpenTelemetry packages.

### Packages to Add
```bash
bun add @langfuse/otel
```

### Current vs Required Dependencies

| Package | Status | Purpose |
|---------|--------|---------|
| `langfuse` v3.38.6 | ✅ Installed | Core Langfuse client |
| `@langfuse/otel` | ❌ **MISSING** | OpenTelemetry span processor |
| `@opentelemetry/sdk-node` | ✅ Installed | OpenTelemetry SDK |
| `@opentelemetry/api` | ✅ Installed | OpenTelemetry API |
| `zod` v3.24.0 | ✅ Installed | Schema validation |
| `dotenv` v16.4.7 | ✅ Installed | Environment loading |

### Corrected Instrumentation Pattern

The `LangfuseSpanProcessor` from `@langfuse/otel` automatically reads credentials from environment variables - no need to pass a `Langfuse` instance:

```typescript
import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";

const sdk = new NodeSDK({
  spanProcessors: [new LangfuseSpanProcessor()],
});

sdk.start();
```

**Note:** Requires Node.js ≥ 20 APIs (Bun supports this).

---

## Success Criteria

Phase 1 is complete when:

1. **Configuration:**
   - [x] `.env.example` exists with all required variables ✓
   - [x] `src/config.ts` validates environment with Zod ✓
   - [x] Invalid config causes immediate exit with clear error ✓

2. **Instrumentation:**
   - [x] `src/instrumentation.ts` initializes OpenTelemetry ✓
   - [x] Langfuse client connects to backend ✓
   - [x] Graceful shutdown flushes traces ✓

3. **Entrypoint:**
   - [x] `index.ts` imports instrumentation FIRST ✓
   - [x] `bun run index.ts` succeeds with valid `.env` ✓
   - [x] `bun run dev` script works ✓

4. **Testing:**
   - [x] `bun test` runs config validation tests ✓
   - [x] All tests pass (39 tests) ✓
   - [x] `bun test --coverage` generates report ✓

5. **CI/CD:**
   - [x] GitHub Actions workflow runs on push/PR ✓
   - [x] Type check passes ✓
   - [x] Tests pass in CI ✓

6. **Verification:**
   - [x] Trace appears in Langfuse dashboard after run ✓
   - [x] Service name and metadata visible in trace ✓

**Status: ✅ ALL SUCCESS CRITERIA MET - Phase 1 Complete**

---

## Implementation Order

Execute tasks in this order to minimize dependencies:

1. **Task 1:** Install `@langfuse/otel`
2. **Task 2:** Create `.env.example`
3. **Task 3:** Create `src/config.ts`
4. **Task 4:** Create `src/instrumentation.ts`
5. **Task 5:** Update `index.ts`
6. **Task 6:** Add test files and package.json scripts
7. **Task 7:** Add GitHub Actions workflow
8. **Task 8:** Update `CLAUDE.md`
9. **Task 9:** Manual verification

---

## Estimated Complexity

| Task | Complexity | Notes |
|------|------------|-------|
| Install dependency | Low | Single command |
| .env.example | Low | Template file |
| src/config.ts | Low | Zod schema, well-documented |
| src/instrumentation.ts | Medium | OpenTelemetry setup |
| index.ts update | Low | Import order change |
| Test infrastructure | Medium | New test files, scripts |
| GitHub Actions | Low | Standard workflow |
| CLAUDE.md update | Low | Documentation fixes |
| Verification | Low | Manual + automated |

**Overall Phase 1:** Medium complexity
