# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**OWASP GraphGuard** is an AI-powered security analysis agent that scans Node.js applications for vulnerabilities aligned with the OWASP Top 10 2021 categories. The agent provides explainable security findings with full observability and auditability.

**Target Application**: Snyk's `nodejs-goof` - a deliberately vulnerable Node.js application used for validation and demos.

## Development Commands

```bash
# Install dependencies
bun install

# Run the main TypeScript entrypoint
bun run index.ts

# Development mode (if configured)
bun run dev

# Run security scan
bun run scan --repo ./nodejs-goof --mode owasp-scan
```

## Technical Architecture

### Core Technology Stack

1. **Agent Orchestration**
   - `@langchain/langgraph`: Stateful graph-based workflows with nodes, edges, and durable execution
   - `@langchain/core` and `langchain`: LLM abstraction, tools, and agent behavior

2. **Code Analysis**
   - `@augmentcode/auggie-sdk`: Codebase indexing, querying, and code-aware tools
   - Auggie client initialized with `workspaceRoot` pointing to target repo and `rules` pointing to OWASP Top 10 2021 rule files

3. **Observability**
   - `@langfuse/tracing` and `@langfuse/otel`: Langfuse TS SDK v4 with OpenTelemetry
   - `@opentelemetry/sdk-node`: Span processing and trace collection
   - **Critical**: `instrumentation.ts` must be imported as the FIRST statement in the entrypoint

4. **LLM Integration**
   - LangChain.js provides model-agnostic interface for various providers (Anthropic, OpenAI, etc.)
   - Tools wrap Auggie operations for code search, file inspection, and vulnerability detection

### LangGraph Workflow Structure

The security analysis follows a multi-node LangGraph `StateGraph`:

1. **Input Node**: Accepts user query, repo path, and OWASP analysis mode
2. **Enumerate Targets**: Uses Auggie tools to identify:
   - Key source directories and entrypoints
   - Routes/controllers and database access code
   - User input handling points
   - Dependency manifests and lockfiles
3. **OWASP Analysis Nodes**: Per-category or aggregated analysis for:
   - Injection vulnerabilities
   - Broken authentication/authorization
   - Security misconfigurations
   - Other OWASP Top 10 2021 categories
4. **Aggregate Findings**: Merges results into structured output with:
   - OWASP category classification
   - Severity and title
   - Evidence (file paths, line ranges, code references)
   - Explanation and recommended fixes
5. **Output Node**: Returns both JSON and human-readable markdown

### Auggie Integration Pattern

When implementing Auggie tools:
- Initialize with `workspaceRoot` pointing to the target repository
- Configure `rules` with OWASP Top 10 2021 markdown files (paraphrased, not copied)
- Define custom tools using Vercel AI SDK tool format with Zod schemas
- Wrap Auggie operations in LangChain-compatible tools

### Observability Requirements

Every agent run must emit:
- Top-level trace with user query, repo path, and OWASP mode metadata
- Nested spans for:
  - Auggie tool invocations
  - LangChain model calls
  - LangGraph node transitions
- Span attributes including:
  - `userId` or session identifier
  - `owasp_category` for category-specific checks
  - `repo` and `branch` metadata

## Environment Variables

Required environment variables (store in `.env`, never commit):

- **Langfuse**: API keys for observability backend
- **Augment**: API key and workspace configuration
- **LLM Provider**: Credentials for chosen model provider (Anthropic, OpenAI, etc.)

## Security Analysis Output Format

Findings are structured as:
```json
{
  "category": "OWASP Top 10 2021 category",
  "title": "Brief finding title",
  "severity": "critical|high|medium|low",
  "evidence": {
    "file": "path/to/file.js",
    "lineRange": "10-25",
    "codeReference": "snippet hash or ID"
  },
  "explanation": "Why this is a vulnerability",
  "recommendedFix": "How to remediate"
}
```

## Key Architectural Patterns

### OpenTelemetry Initialization
The `instrumentation.ts` file initializes `NodeSDK` with `LangfuseSpanProcessor` from `@langfuse/otel`. This file must be imported FIRST in the Bun entrypoint before any other imports to ensure proper trace capture.

### OWASP Rule Management
OWASP Top 10 2021 content is embedded through:
- System prompts referencing category names, descriptions, and patterns
- Rule markdown files (paraphrased, not copied) loaded by Auggie
- Per-category analysis logic in LangGraph nodes

### Tool Composition
Tools are layered:
1. Auggie SDK provides low-level code query capabilities
2. LangChain tools wrap Auggie operations with standardized interfaces
3. LangGraph nodes orchestrate multi-tool workflows for comprehensive analysis

## Non-Goals (v1)

- No automatic remediation or PR generation
- No web UI (CLI only)
- No CI/CD or Git hosting integration
- No multi-repo or monorepo support
- No support for non-JavaScript/TypeScript/Node targets
