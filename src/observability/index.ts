/**
 * Enhanced Langfuse Observability Module
 *
 * This module provides typed wrappers around @langfuse/tracing for rich
 * observation types specific to GraphGuard's security analysis workflow.
 *
 * Observation Types Used:
 * - `generation`: LLM calls with model, tokens, costs, prompt linking
 * - `tool`: Auggie SDK tool invocations
 * - `retriever`: Code search and file content retrieval
 * - `chain`: Prompt loading and compilation steps
 * - `agent`: Graph node orchestration
 * - `span`: General-purpose timing (default)
 *
 * These work alongside @langfuse/otel's LangfuseSpanProcessor which is
 * initialized in instrumentation.ts. Both share the same OpenTelemetry
 * context, so observations nest correctly.
 */

import {
    startActiveObservation,
    startObservation,
    updateActiveObservation,
    updateActiveTrace,
} from '@langfuse/tracing';
import type { OwaspCategory } from '../graph/state';

// Re-export core tracing functions for convenience
export {
    startActiveObservation,
    startObservation,
    updateActiveObservation,
    updateActiveTrace
};

/**
 * Observation type constants for type safety
 */
export const ObservationType = {
  GENERATION: 'generation',
  TOOL: 'tool',
  RETRIEVER: 'retriever',
  CHAIN: 'chain',
  AGENT: 'agent',
  SPAN: 'span',
  EVENT: 'event',
  EVALUATOR: 'evaluator',
  GUARDRAIL: 'guardrail',
  EMBEDDING: 'embedding',
} as const;

export type ObservationTypeValue = (typeof ObservationType)[keyof typeof ObservationType];

/**
 * Common metadata for OWASP-related observations
 */
export interface OwaspObservationMeta {
  scanId: string;
  owaspCategory?: OwaspCategory;
  repoPath?: string;
}

/**
 * Usage details for LLM generation observations
 * Uses index signature to match Langfuse SDK types
 */
export type UsageDetails = {
  [key: string]: number;
};

/**
 * Cost details for LLM generation observations
 * Uses index signature to match Langfuse SDK types
 */
export type CostDetails = {
  [key: string]: number;
};

/**
 * Wrapper for LLM generation observations
 * Tracks model, tokens, costs, and links to Langfuse prompts
 */
export async function withGeneration<T>(
  name: string,
  model: string,
  fn: () => Promise<{ result: T; usage?: UsageDetails; cost?: CostDetails }>,
  options?: {
    input?: unknown;
    promptName?: string;
    promptVersion?: number;
    metadata?: Record<string, unknown>;
  }
): Promise<T> {
  return startActiveObservation(
    name,
    async (obs) => {
      obs.update({
        model,
        input: options?.input,
        metadata: {
          ...options?.metadata,
          ...(options?.promptName && { promptName: options.promptName }),
          ...(options?.promptVersion && { promptVersion: options.promptVersion }),
        },
      });

      const { result, usage, cost } = await fn();

      obs.update({
        output: result,
        ...(usage && { usageDetails: usage }),
        ...(cost && { costDetails: cost }),
      });

      return result;
    },
    { asType: 'generation' }
  );
}

/**
 * Wrapper for tool observations (Auggie SDK calls)
 */
export async function withTool<T>(
  name: string,
  fn: () => Promise<T>,
  options?: { input?: unknown; metadata?: Record<string, unknown> }
): Promise<T> {
  return startActiveObservation(
    name,
    async (obs) => {
      if (options?.input) obs.update({ input: options.input, metadata: options?.metadata });
      const result = await fn();
      obs.update({ output: result });
      return result;
    },
    { asType: 'tool' }
  );
}

/**
 * Wrapper for retriever observations (code search, file reads)
 */
export async function withRetriever<T>(
  name: string,
  fn: () => Promise<T>,
  options?: { input?: unknown; metadata?: Record<string, unknown> }
): Promise<T> {
  return startActiveObservation(
    name,
    async (obs) => {
      if (options?.input) obs.update({ input: options.input, metadata: options?.metadata });
      const result = await fn();
      obs.update({ output: result });
      return result;
    },
    { asType: 'retriever' }
  );
}

/**
 * Wrapper for chain observations (prompt loading, data transformation)
 */
export async function withChain<T>(
  name: string,
  fn: () => Promise<T>,
  options?: { input?: unknown; metadata?: Record<string, unknown> }
): Promise<T> {
  return startActiveObservation(
    name,
    async (obs) => {
      if (options?.input) obs.update({ input: options.input, metadata: options?.metadata });
      const result = await fn();
      obs.update({ output: result });
      return result;
    },
    { asType: 'chain' }
  );
}

/**
 * Wrapper for agent observations (graph node orchestration)
 */
export async function withAgent<T>(
  name: string,
  fn: () => Promise<T>,
  options?: { input?: unknown; metadata?: Record<string, unknown> }
): Promise<T> {
  return startActiveObservation(
    name,
    async (obs) => {
      if (options?.input) obs.update({ input: options.input, metadata: options?.metadata });
      const result = await fn();
      obs.update({ output: result });
      return result;
    },
    { asType: 'agent' }
  );
}

/**
 * Set trace-level attributes for the current scan
 * Call early in the trace to ensure all observations inherit these
 */
export function setTraceContext(context: {
  scanId: string;
  repoPath?: string;
  userId?: string;
  sessionId?: string;
  tags?: string[];
}) {
  updateActiveTrace({
    name: `graphguard-scan-${context.scanId}`,
    userId: context.userId,
    sessionId: context.sessionId ?? context.scanId,
    metadata: {
      scanId: context.scanId,
      repoPath: context.repoPath,
    },
    tags: context.tags ?? ['graphguard', 'owasp'],
  });
}

/**
 * Add OWASP category context to the current observation
 */
export function setOwaspContext(category: OwaspCategory, scanId: string) {
  updateActiveObservation({
    metadata: {
      owaspCategory: category,
      scanId,
    },
  });
}

/**
 * LLM generation options for OWASP analysis
 */
export interface LlmGenerationOptions {
  /** Model identifier (e.g., 'claude-3-5-sonnet-20241022') */
  model: string;
  /** Input messages or prompt text */
  input: unknown;
  /** OWASP category being analyzed */
  owaspCategory?: OwaspCategory;
  /** Langfuse prompt name for linking */
  promptName?: string;
  /** Langfuse prompt version for linking */
  promptVersion?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * LLM generation result with usage tracking
 */
export interface LlmGenerationResult<T> {
  /** The actual result from the LLM */
  result: T;
  /** Token usage details */
  usage?: UsageDetails;
  /** Cost details */
  cost?: CostDetails;
}

/**
 * Wrapper for OWASP-specific LLM generation observations
 *
 * Use this when making LLM calls for security analysis.
 * Automatically tracks:
 * - Model name
 * - Input/output
 * - Token usage (input, output, total)
 * - Cost (if provided)
 * - Prompt linking to Langfuse Prompt Management
 * - OWASP category context
 *
 * @example
 * ```typescript
 * const analysis = await withOwaspGeneration(
 *   'analyze_injection',
 *   {
 *     model: 'claude-3-5-sonnet-20241022',
 *     input: { systemPrompt, userPrompt, codeContext },
 *     owaspCategory: 'A03:2021-Injection',
 *     promptName: 'owasp-A03-analysis',
 *     promptVersion: 1,
 *   },
 *   async () => {
 *     const response = await anthropic.messages.create({...});
 *     return {
 *       result: parseFindings(response.content),
 *       usage: {
 *         input: response.usage.input_tokens,
 *         output: response.usage.output_tokens,
 *         total: response.usage.input_tokens + response.usage.output_tokens,
 *       },
 *     };
 *   }
 * );
 * ```
 */
export async function withOwaspGeneration<T>(
  name: string,
  options: LlmGenerationOptions,
  fn: () => Promise<LlmGenerationResult<T>>
): Promise<T> {
  return startActiveObservation(
    name,
    async (obs) => {
      // Set initial observation attributes
      obs.update({
        model: options.model,
        input: options.input,
        metadata: {
          ...options.metadata,
          ...(options.owaspCategory && { owaspCategory: options.owaspCategory }),
          ...(options.promptName && { promptName: options.promptName }),
          ...(options.promptVersion && { promptVersion: options.promptVersion }),
        },
      });

      // Execute the LLM call
      const { result, usage, cost } = await fn();

      // Update with output and usage
      obs.update({
        output: result,
        ...(usage && { usageDetails: usage }),
        ...(cost && { costDetails: cost }),
      });

      return result;
    },
    { asType: 'generation' }
  );
}
