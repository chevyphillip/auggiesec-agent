/**
 * OpenTelemetry + Langfuse instrumentation for OWASP GraphGuard
 *
 * CRITICAL: This file MUST be imported FIRST in the entrypoint.
 * The OpenTelemetry SDK must initialize before any other code runs
 * to capture all traces from module initialization onwards.
 */
import 'dotenv/config';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { trace } from '@opentelemetry/api';

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
const sdk = new NodeSDK({
  spanProcessors: [
    new LangfuseSpanProcessor({
      baseUrl: process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com',
    }),
  ],
});

sdk.start();
console.log('[instrumentation] OpenTelemetry + Langfuse initialized');

// Graceful shutdown handlers
const shutdown = async () => {
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
