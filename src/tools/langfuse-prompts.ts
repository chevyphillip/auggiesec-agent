/**
 * Langfuse Prompt Loading Utilities
 *
 * Provides utilities to fetch and cache OWASP analysis prompts from Langfuse.
 * Prompts are versioned and labeled in Langfuse Prompt Management.
 *
 * Uses 'retriever' observation type for prompt loading to track:
 * - Prompt name, label, version
 * - Compilation variables
 * - Fallback usage
 */

import { startActiveObservation } from '@langfuse/tracing';
import { SpanStatusCode } from '@opentelemetry/api';
import { Langfuse } from 'langfuse';
import { tracer } from '../instrumentation';

// Singleton Langfuse client
let langfuseClient: Langfuse | null = null;

/**
 * Get or initialize the Langfuse client
 * Reads LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, and LANGFUSE_HOST from environment
 */
export function getLangfuseClient(): Langfuse {
  if (!langfuseClient) {
    // Use LANGFUSE_HOST if specified (for US region or self-hosted)
    const baseUrl = process.env.LANGFUSE_HOST || process.env.LANGFUSE_BASE_URL;
    langfuseClient = new Langfuse({
      baseUrl,
    });
  }
  return langfuseClient;
}

/**
 * Prompt configuration for OWASP analysis
 */
export interface PromptConfig {
  name: string;
  label?: string;
  version?: number;
}

/**
 * Compiled prompt result
 */
export interface CompiledPrompt {
  text: string;
  name: string;
  version: number;
  label?: string;
  isFallback: boolean;
}

/**
 * Fetch a prompt from Langfuse with fallback support
 *
 * Uses 'retriever' observation type to track prompt retrieval in Langfuse dashboard
 * with rich metadata about prompt name, version, label, and variables.
 *
 * @param config - Prompt configuration (name, optional label/version)
 * @param variables - Variables to compile into the prompt template
 * @param fallbackText - Fallback text if prompt cannot be fetched
 * @returns Compiled prompt text
 */
export async function getPrompt(
  config: PromptConfig,
  variables: Record<string, string> = {},
  fallbackText?: string
): Promise<CompiledPrompt> {
  // Use 'chain' observation type for richer Langfuse dashboard experience
  return startActiveObservation(
    `prompt.${config.name}`,
    async (chainObs) => {
      // Set input with prompt config and variables
      chainObs.update({
        input: {
          promptName: config.name,
          label: config.label || 'production',
          requestedVersion: config.version ?? 'latest',
          variableKeys: Object.keys(variables),
        },
        metadata: {
          promptName: config.name,
          label: config.label || 'production',
        },
      });

      // Also create OTel span for backward compatibility with existing traces
      return tracer.startActiveSpan('langfuse.get_prompt', async (span) => {
        try {
          span.setAttributes({
            'prompt.name': config.name,
            'prompt.label': config.label || 'production',
            'prompt.version': config.version || -1,
          });

          const client = getLangfuseClient();

          // Fetch prompt with optional fallback
          const prompt = await client.getPrompt(config.name, config.version, {
            ...(config.label && { label: config.label }),
            ...(fallbackText && { fallback: fallbackText }),
          });

          // Compile the prompt with variables
          const compiledText = prompt.compile(variables);

          span.setAttributes({
            'prompt.version_fetched': prompt.version,
            'prompt.is_fallback': prompt.isFallback,
          });
          span.setStatus({ code: SpanStatusCode.OK });

          const result: CompiledPrompt = {
            text: compiledText,
            name: config.name,
            version: prompt.version,
            label: config.label,
            isFallback: prompt.isFallback,
          };

          // Update chain observation with output
          chainObs.update({
            output: {
              version: prompt.version,
              isFallback: prompt.isFallback,
              compiledLength: compiledText.length,
            },
          });

          return result;
        } catch (error) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : String(error),
          });
          span.recordException(error as Error);

          // Return fallback if available
          if (fallbackText) {
            console.warn(`[langfuse] Failed to fetch prompt "${config.name}", using fallback`);
            const fallbackResult: CompiledPrompt = {
              text: fallbackText,
              name: config.name,
              version: 0,
              label: config.label,
              isFallback: true,
            };

            chainObs.update({
              output: { version: 0, isFallback: true, error: 'used_fallback' },
              level: 'WARNING',
            });

            return fallbackResult;
          }

          throw error;
        } finally {
          span.end();
        }
      });
    },
    { asType: 'retriever' }
  );
}

/**
 * Predefined prompt names for OWASP analysis
 * Maps OWASP category codes to Langfuse prompt names
 */
export const OWASP_PROMPTS: Record<string, string> = {
  A01: 'owasp-a01-broken-access-control',
  A02: 'owasp-a02-cryptographic-failures',
  A03: 'owasp-a03-injection',
  A04: 'owasp-a04-insecure-design',
  A05: 'owasp-a05-security-misconfiguration',
  A06: 'owasp-a06-vulnerable-components',
  A07: 'owasp-a07-auth-failures',
  A08: 'owasp-a08-integrity-failures',
  A09: 'owasp-a09-logging-failures',
  A10: 'owasp-a10-ssrf',
  ORCHESTRATOR: 'owasp-analysis-orchestrator',
} as const;

export type OwaspPromptName = (typeof OWASP_PROMPTS)[keyof typeof OWASP_PROMPTS];

/**
 * Get an OWASP analysis prompt by category code
 *
 * @param categoryCode - OWASP category code (e.g., 'A03')
 * @param variables - Variables to compile into the prompt
 * @param label - Prompt label (default: 'production')
 */
export async function getOwaspPrompt(
  categoryCode: string,
  variables: Record<string, string> = {},
  label: string = 'production'
): Promise<CompiledPrompt> {
  // Map category code to actual Langfuse prompt name
  const promptName = OWASP_PROMPTS[categoryCode] || `owasp-${categoryCode.toLowerCase()}-analysis`;

  return getPrompt(
    { name: promptName, label },
    variables,
    `Analyze the code for ${categoryCode} vulnerabilities based on OWASP Top 10 2021.`
  );
}
