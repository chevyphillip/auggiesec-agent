/**
 * OpenTelemetry + Langfuse instrumentation for OWASP GraphGuard
 *
 * CRITICAL: This file MUST be imported FIRST in the entrypoint.
 * The OpenTelemetry SDK must initialize before any other code runs
 * to capture all traces from module initialization onwards.
 *
 * ## Dual Observability Approach
 *
 * GraphGuard uses two complementary Langfuse packages:
 *
 * ### 1. @langfuse/otel (this file)
 * - Provides `LangfuseSpanProcessor` for automatic OpenTelemetry span processing
 * - All spans created via `tracer.startActiveSpan()` are automatically sent to Langfuse
 * - Best for: General tracing, timing, error tracking, span attributes
 * - Used by: Graph nodes, tool wrappers, general application code
 *
 * ### 2. @langfuse/tracing (src/observability/index.ts)
 * - Provides rich observation types: generation, tool, retriever, chain, agent
 * - Enables LLM-specific tracking: model, tokens, costs, prompt linking
 * - Best for: LLM calls, tool invocations, prompt loading, agent orchestration
 * - Used by: LLM wrappers, Auggie tools, prompt loading, graph orchestration
 *
 * ### How They Work Together
 *
 * Both packages share the same OpenTelemetry context, so observations nest correctly:
 *
 * ```
 * Trace (graphguard-scan)
 * └── Agent: graphguard_security_analysis (from @langfuse/tracing)
 *     └── Span: security_analysis.run (from @langfuse/otel via tracer)
 *         ├── Span: node.enumerate (from @langfuse/otel)
 *         │   └── Retriever: search_code (from @langfuse/tracing)
 *         │       └── Span: tool.search_code (from @langfuse/otel)
 *         ├── Span: node.analyze (from @langfuse/otel)
 *         │   └── Generation: analyze_injection (from @langfuse/tracing)
 *         │       └── Chain: prompt.owasp-A03-analysis (from @langfuse/tracing)
 *         └── Span: node.aggregate (from @langfuse/otel)
 * ```
 *
 * ### Usage Guidelines
 *
 * - Use `tracer.startActiveSpan()` for general timing and error tracking
 * - Use `withGeneration()` for LLM calls (tracks model, tokens, costs)
 * - Use `withTool()` for Auggie SDK tool invocations
 * - Use `withRetriever()` for code search and file content retrieval
 * - Use `withChain()` for prompt loading and data transformation
 * - Use `withAgent()` for graph orchestration
 *
 * See src/observability/index.ts for the typed observation wrappers.
 */
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { trace } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import 'dotenv/config';

// Validate required environment variables early
const requiredVars = ['LANGFUSE_PUBLIC_KEY', 'LANGFUSE_SECRET_KEY'];
for (const envVar of requiredVars) {
  if (!process.env[envVar]) {
    console.error(`[instrumentation] Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Initialize OpenTelemetry SDK with Langfuse span processor
// LangfuseSpanProcessor automatically reads LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY from env
const langfuseBaseUrl =
  process.env.LANGFUSE_BASE_URL || process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com';

const sdk = new NodeSDK({
  spanProcessors: [
    new LangfuseSpanProcessor({
      baseUrl: langfuseBaseUrl,
    }),
  ],
});

console.log(`[instrumentation] Langfuse endpoint: ${langfuseBaseUrl}`);

sdk.start();
console.log('[instrumentation] OpenTelemetry + Langfuse initialized');

// Track shutdown state to prevent double-shutdown
let isShuttingDown = false;

// Graceful shutdown handlers
const shutdown = async () => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('[instrumentation] Shutting down...');
  await sdk.shutdown();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Export tracer for use in application code (Phase 2+)
export const tracer = trace.getTracer('graphguard', '0.1.0');

// Export SDK for testing purposes
export { sdk };
