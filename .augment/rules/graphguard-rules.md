---
type: "always_apply"
---

# GraphGuard Agent Rules

The following rules enforce critical architectural patterns for the auggiesec-agent (OWASP GraphGuard) project. Violations will break observability, configuration, or integration patterns.

---

## Rule 1: Instrumentation-First Import Order

**Every entrypoint file (index.ts, cli.ts, or any file that bootstraps the application) MUST import `./src/instrumentation` as its absolute first import before any other code.** This ensures OpenTelemetry + Langfuse tracing is initialized before any modules execute, capturing all spans. Violating this order means traces will be incomplete or missing entirely.

```typescript
// CORRECT - instrumentation.ts MUST be first
import './src/instrumentation';  // MUST BE FIRST LINE
import { runScan } from './src/cli';
```

---

## Rule 2: Environment-Only Configuration (12-Factor)

**Never hardcode secrets, API keys, or environment-specific values in source code—always read from environment variables via `src/config.ts` with Zod validation.** All configuration must pass through the validated `Config` type exported from `src/config.ts`. Required keys include `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, and eventually `AUGMENT_API_KEY` and `ANTHROPIC_API_KEY`. The application must fail-fast with exit code 1 on validation failure.

---

## Rule 3: Traced Operations with Span Attributes

**Every tool call, LangGraph node execution, and LLM invocation MUST be wrapped in an OpenTelemetry span using the exported `tracer` from `src/instrumentation.ts`, with required attributes: `scan.id`, `repo.path`, `owasp.category` (where applicable), and `finding.severity`.** Use the `safeToolCall` wrapper pattern for error handling that records exceptions to spans. This ensures full auditability in Langfuse.

---

## Rule 4: LangChain Tool Definitions with Zod Schemas

**All Auggie SDK wrapper tools MUST be defined using `DynamicStructuredTool` from `@langchain/core/tools` with Zod schemas for input validation, following the pattern in `src/tools/`.** Tool names must be snake_case, descriptions must be clear for LLM consumption, and the `func` implementation must call Auggie SDK methods and return JSON-stringified results. This ensures type-safe, schema-validated tool I/O that integrates correctly with LangGraph.
