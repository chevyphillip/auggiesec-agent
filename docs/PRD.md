# Product Requirements Document (PRD)
## Project: OWASP GraphGuard (TS + LangGraph + LangChain + Augment + Langfuse + Bun)

---

## 1. Problem statement

Modern engineering teams struggle to quickly understand, triage, and classify application security vulnerabilities across large codebases and dependencies. The goal of this project is to build an AI Agent that can analyze a vulnerable Node.js application, reason using OWASP Top 10 2021 categories, and produce actionable security findings with full observability and auditability.

The first target application under test will be `nodejs-goof`, a deliberately vulnerable Node.js app from Snyk Labs, which provides real-world vulnerability patterns for validation and demos.[web:1]

---

## 2. Goals and non‑goals

### 2.1 Goals

- Automatically analyze application code, configuration, and dependency data for security issues aligned to OWASP Top 10 2021 categories.[web:2]
- Classify each finding into OWASP categories (e.g., injection, broken access control, security misconfiguration) with severity, explanation, and remediation guidance.[web:2]
- Provide explainable reasoning traces, including which files, functions, and dependency data were consulted.
- Support iterative, conversational interaction with the agent (e.g., “show me examples of injection issues in this repo”).
- Emit rich observability/tracing data for every agent run (inputs, tools, OWASP checks, outputs) via Langfuse TS SDK built on OpenTelemetry.[file:1]
- Be framework- and model-provider-agnostic enough to later plug in different LLMs and tools.

### 2.2 Non‑goals (v1)

- Not a full automatic remediation engine (patch suggestions may be provided, but no auto-PRs in v1).
- No interactive web UI beyond a simple CLI or minimal HTTP endpoint.
- No integration with CI/CD or Git hosting in v1 (future extension).

---

## 3. Users and use cases

### 3.1 Primary users

- Application Security Engineers needing quick, explainable triage of vulnerabilities in a specific service/repository.
- Security‑minded developers wanting OWASP-aligned feedback on their repo without deep security expertise.

### 3.2 Core use cases

- “Scan this repo and summarize vulnerabilities by OWASP Top 10 category.”
- “Explain why this particular route/controller is vulnerable, mapped to OWASP, with code references.”
- “Compare two commits or branches and highlight new OWASP-relevant risks introduced.”

---

## 4. Scope and key features

### 4.1 In-scope functionality (v1)

- Single-repo analysis for `nodejs-goof` (local clone on disk).[web:1]
- OWASP Top 10 2021 knowledge embedded in system prompts and/or rule files for the agent.[web:2]
- Use Augment’s TypeScript SDK (Auggie) to:
  - Index and query the codebase and rules files.
  - Expose code-aware tools (e.g., “find usages of X”, “show controllers”, “list routes”).[web:3]
- Use LangChain.js for:
  - Model abstraction.
  - Tool definitions.
  - Simple agent behavior (if needed) for OWASP analysis.[web:4]
- Use LangGraph.js for:
  - Orchestrating multi-step workflows (e.g., enumerate endpoints → analyze per OWASP category → aggregate findings).[web:5]
- Use Langfuse TS SDK v4 for:
  - Tracing all agent runs, OWASP checks, and tool invocations via OpenTelemetry and `@langfuse/tracing` + `@langfuse/otel`.[file:1]
- Use **Bun** as:
  - Runtime, package manager, and script runner for the TypeScript project, including dev and build workflows.[web:6]

### 4.2 Out-of-scope (v1)

- Multi-repo / monorepo cross-project correlation.
- CI hooks, GitHub Apps, or GitLab integration.
- Non-JavaScript/TypeScript/Node targets.

---

## 5. Technical architecture

### 5.1 Core technology stack

- Language/runtime: TypeScript running on **Bun** (Node-compatible runtime, package manager, and bundler) to execute the agent and tooling.[web:6]
- Agent orchestration:
  - `@langchain/langgraph` (LangGraph.js) for stateful graphs, nodes, edges, and durable workflows.[web:5]
  - `@langchain/core` and `langchain` for LLMs, tools, and agents.[web:4][web:5]
- Observability:
  - `@langfuse/tracing` and `@langfuse/otel` (Langfuse TS SDK v4) with OpenTelemetry `@opentelemetry/sdk-node` for traces and span processing.[file:1]
- Code context:
  - `@augmentcode/auggie-sdk` for interacting with Auggie CLI backend and using rules + custom tools.[web:3]
- Target app under test:
  - Snyk Labs `nodejs-goof` vulnerable Node.js app (cloned locally).[web:1]

### 5.2 Integration overview

1. **Auggie / Augment**
   - Initialize Auggie client with:
     - `workspaceRoot` pointing to local `nodejs-goof` repo.
     - `rules` pointing to OWASP Top 10 2021 rules markdown file(s).
     - Optional custom tools for code queries, following Vercel AI SDK tool format and Zod schemas.[web:3]

2. **LangChain + LangGraph**
   - Use LangChain’s model interface to connect to chosen LLM (e.g., Anthropic, OpenAI, etc.).[web:4]
   - Define tools that call Auggie (e.g., “search code for X”, “list vulnerable endpoints”, “summarize finding in OWASP terms”).[web:3][web:4]
   - Build a LangGraph `StateGraph` to:
     - Ingest user query and context.
     - Enumerate targets (files, endpoints) via Auggie tools.
     - Run per-OWASP-category analyzers.
     - Aggregate findings into a final structured report.[web:5]

3. **Langfuse observability**
   - Initialize OpenTelemetry `NodeSDK` with `LangfuseSpanProcessor` from `@langfuse/otel` in `instrumentation.ts`, and import it as the first statement in the entrypoint, executed via Bun.[file:1][web:6]
   - Use Langfuse `startActiveObservation` to wrap agent invocations so all nested LangChain/LangGraph operations are traced.[file:1]
   - Optionally use `@langfuse/langchain` for automatic LangChain integration.[file:1]

4. **Bun usage model**

- Use Bun to:
  - Install dependencies: `bun add @langfuse/tracing @langfuse/otel @opentelemetry/sdk-node langchain @langchain/langgraph @augmentcode/auggie-sdk` etc.[file:1][web:4][web:5][web:6]
  - Run dev scripts: `bun run dev`, `bun run scan` for CLI entrypoints.
  - Build/bundle TypeScript if needed via Bun’s built-in tooling.[web:6]

---

## 6. Functional requirements

### 6.1 OWASP context and rules

- The agent must incorporate OWASP Top 10 2021 content as high-level domain knowledge for:
  - Category names and descriptions.
  - Typical vulnerability patterns and examples relevant to Node.js / web apps.
  - Remediation guidance.[web:2]
- OWASP content must be referenced and paraphrased in prompts and rule files (no direct copying of copyrighted text).

### 6.2 Analysis workflow

Each run should:

1. Accept input:
   - Repo path (default: `./nodejs-goof`).
   - Optional scope filters (e.g., “only routes”, “only dependencies”).
   - User question or use case (e.g., “scan for injection issues and classify by OWASP category”).

2. Enumerate analysis targets via Auggie tools:
   - Identify key source directories and entrypoints.
   - Identify routes/controllers, database access code, and user input handling.
   - Optionally identify dependency manifests and lockfiles.[web:3]

3. Perform OWASP-based checks:
   - Run a LangGraph flow where each node corresponds to a logical step:
     - Gather-code-context.
     - Analyze for specific OWASP categories (e.g., injection, auth, misconfiguration).
     - Produce intermediate findings with code references and evidence.[web:5]

4. Aggregate and classify findings:
   - Merge results into a final structured object:
     - `category` (OWASP Top 10 2021).
     - `title`.
     - `severity`.
     - `evidence` (file, line ranges, code snippet hash/ID).
     - `explanation`.
     - `recommended fix`.
   - Return as JSON and human-readable markdown.

### 6.3 Interaction model

- CLI interface (via Bun):
  - `bun run scan --repo ./nodejs-goof --mode owasp-scan`
  - Output both:
    - Human-readable summary to stdout.
    - JSON results file for programmatic downstream use.
- Programmatic API:
  - Export a function `runOwaspScan(params)` returning a structured result.

### 6.4 Observability requirements

- Every run must emit:
  - Top-level trace with user query, repo path, and OWASP mode metadata.
  - Nested spans/observations for:
    - Auggie tool invocations.
    - LangChain model calls.
    - LangGraph node transitions (if possible via LangChain/LangGraph integrations).[file:1][web:5]
- Span attributes should include:
  - `userId` or session identifier (dev/test default).
  - `owasp_category` for category-specific checks where applicable.
  - `repo` and `branch` metadata.[file:1]
- Traces must appear in Langfuse UI using TS SDK v4 integration.[file:1]

---

## 7. Non‑functional requirements

- **Performance**: Initial scans may be slow, but single-repo analysis should complete in a few minutes on a typical workstation using Bun with caching/indexing enabled.[web:6]
- **Security**:
  - No external exfiltration of code beyond Augment and Langfuse backends configured by the user.[file:1][web:3]
  - Protect API keys and tokens via environment variables and `.env` file, not source code.[file:1]
- **Reliability**:
  - LangGraph workflows should be resilient to intermittent model/tool failures (retry or mark partial failures).[web:5]
- **Explainability**:
  - Each finding must be explainable and traceable in Langfuse (which code, which tools, what reasoning).[file:1]

---

## 8. Implementation plan (high-level)

### Implementation Status

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1 | ✅ COMPLETE | Skeleton, Bun setup, observability wiring |
| Phase 2 | ✅ COMPLETE | OpenTelemetry + Langfuse instrumentation |
| Phase 3 | ✅ COMPLETE | LangGraph agent scaffold |
| Phase 4 | 🔄 NEXT | Auggie + Tools + OWASP rules |
| Phase 5 | ⏳ NOT STARTED | CLI & Testing with nodejs-goof |

### 8.1 Phase 1: Skeleton, Bun setup, observability wiring ✅ COMPLETE

- Initialize a Bun + TypeScript project:
  - Use Bun to create the project and manage dependencies (`bun init`, `bun add ...`).[web:6]
  - Add `@langfuse/tracing`, `@langfuse/otel`, `@opentelemetry/sdk-node` and configure Langfuse env vars.[file:1]
  - Add `@langchain/langgraph`, `@langchain/core`, `langchain` for LLM + graph orchestration.[web:4][web:5]
  - Add `@augmentcode/auggie-sdk` and local Auggie setup.[web:3]
- Implement `instrumentation.ts` and import it first in the Bun entrypoint.[file:1][web:6]

**Deliverables:**
- `src/instrumentation.ts` - OpenTelemetry + Langfuse initialization
- `src/config.ts` - Zod-based configuration validation
- `.env.example` - Environment template
- `.github/workflows/test.yml` - CI workflow

### 8.2 Phase 2: Observability Wiring ✅ COMPLETE

- Full OpenTelemetry integration with Langfuse span processor
- Configuration validation with Zod schemas
- Test infrastructure with bun:test
- 20 passing tests for config and instrumentation

### 8.3 Phase 3: LangGraph Agent Scaffold ✅ COMPLETE

- Build a LangGraph `StateGraph` with 5 nodes:
  - `input` - Scan initialization with timing
  - `enumerate` - Target discovery (placeholder for Auggie)
  - `analyze` - Security analysis (placeholder for LLM)
  - `aggregate` - Findings aggregation + markdown summary
  - `output` - Scan finalization
- `SecurityAnalysisStateAnnotation` with all 10 OWASP Top 10 2021 categories
- `SecurityFinding` interface matching PRD Section 6.4
- Full OpenTelemetry tracing for each node
- 39 passing tests total

**Deliverables:**
- `src/graph/state.ts` - State types and OWASP categories
- `src/graph/nodes/*.ts` - 5 node implementations
- `src/graph/index.ts` - Graph assembly + `runSecurityAnalysis()`
- `src/graph/*.test.ts` - Comprehensive test coverage

### 8.4 Phase 4: Auggie + Tools + OWASP Rules 🔄 NEXT

- Create OWASP rule prompts and rule markdown files (paraphrased, not copied) for each Top 10 2021 category.[web:2]
- Implement Auggie SDK wrapper tools for code search and file inspection.[web:3][web:4]
- Wire LLM (Anthropic/OpenAI) to analysis node
- Implement per-category analysis or single "all-OWASP" analysis node
- Map raw agent findings into normalized vulnerability data model

### 8.5 Phase 5: CLI & Testing with `nodejs-goof`

- Clone `nodejs-goof` and run multiple scans using Bun scripts.[web:1][web:6]
- Validate that:
  - Common vulnerabilities are discovered and correctly categorized.
  - Langfuse traces show the full chain of reasoning.
- Adjust prompts, tools, and LangGraph flow for better precision/recall.[web:5][file:1]
- Create CLI with argument parsing (`bun run scan`)

---

## 9. Open questions

- Which exact LLM provider/model(s) to use for v1.
- How to structure OWASP rule files for best synergy with Auggie rules mechanism vs system prompts.[web:3]
- Whether to start with a single “all-OWASP” analysis node or separate category nodes in LangGraph for better observability and control.[web:5]

---

## 10. Dependencies

- Access to Langfuse cloud or self-hosted Langfuse ≥ 3.95.0 for TS SDK v4 features.[file:1]
- Augment account and `auggie` CLI installed and configured with API key and workspace pointing to the `nodejs-goof` repo.[web:3]
- LLM provider credentials (API keys).
- Local environment with **Bun** installed and configured as the JS runtime and package manager.[web:6]

---

## 11. Context

- Langfuse TypeScript SDK v4 overview
  https://langfuse.com/docs/observability/sdk/typescript/overview [web:67]

- Langfuse TypeScript SDK v4 setup (OpenTelemetry example)
  https://langfuse.com/docs/observability/sdk/typescript/setup [web:68]

- Langfuse JS/TS SDKs GitHub repo
  https://github.com/langfuse/langfuse-js [web:57]

- LangGraph.js overview (JavaScript docs)
  https://docs.langchain.com/oss/javascript/langgraph/overview [web:82]

- LangChain.js overview (JavaScript docs)
  https://docs.langchain.com/oss/javascript/langchain/overview [web:77]

- LangGraph.js concept guide
  https://dev.to/zand/langgraphjs-concept-guide-50g0 [web:71]

- Augment TypeScript SDK (Auggie SDK)
  https://docs.augmentcode.com/cli/sdk-typescript [web:23]

- Augment SDK general intro
  https://docs.augmentcode.com/cli/sdk [web:24]

- OWASP Top 10 2021 introduction
  https://owasp.org/Top10/A00_2021_Introduction/ [web:74][web:79]

- `nodejs-goof` vulnerable app repo
  https://github.com/snyk-labs/nodejs-goof [web:78]

- Bun JavaScript runtime intro
  https://www.linode.com/docs/guides/introduction-to-bun/ [web:75]

- Bun JavaScript runtime overview
  https://www.sitepoint.com/bun-javascript-runtime-introduction/ [web:80]
