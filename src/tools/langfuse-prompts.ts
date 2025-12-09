/**
 * Langfuse Prompt Loading Utilities
 *
 * Provides utilities to fetch and cache OWASP analysis prompts from Langfuse.
 * Prompts are versioned and labeled in Langfuse Prompt Management.
 */

import { SpanStatusCode } from '@opentelemetry/api';
import { Langfuse } from 'langfuse';
import { tracer } from '../instrumentation';

// Singleton Langfuse client
let langfuseClient: Langfuse | null = null;

/**
 * Get or initialize the Langfuse client
 * Reads LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY from environment
 */
export function getLangfuseClient(): Langfuse {
  if (!langfuseClient) {
    langfuseClient = new Langfuse();
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
  return tracer.startActiveSpan('langfuse.get_prompt', async (span) => {
    try {
      span.setAttributes({
        'prompt.name': config.name,
        'prompt.label': config.label || 'production',
        'prompt.version': config.version || -1,
      });

      const client = getLangfuseClient();

      // Fetch prompt with optional fallback
      // getPrompt(name, version?, options?)
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

      return {
        text: compiledText,
        name: config.name,
        version: prompt.version,
        label: config.label,
        isFallback: prompt.isFallback,
      };
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      span.recordException(error as Error);

      // Return fallback if available
      if (fallbackText) {
        console.warn(`[langfuse] Failed to fetch prompt "${config.name}", using fallback`);
        return {
          text: fallbackText,
          name: config.name,
          version: 0,
          label: config.label,
          isFallback: true,
        };
      }

      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Predefined prompt names for OWASP analysis
 */
export const OWASP_PROMPTS = {
  SYSTEM: 'owasp-system-prompt',
  A01_BROKEN_ACCESS: 'owasp-A01-analysis',
  A02_CRYPTO: 'owasp-A02-analysis',
  A03_INJECTION: 'owasp-A03-analysis',
  A04_INSECURE_DESIGN: 'owasp-A04-analysis',
  A05_MISCONFIGURATION: 'owasp-A05-analysis',
  A06_VULNERABLE_COMPONENTS: 'owasp-A06-analysis',
  A07_AUTH_FAILURES: 'owasp-A07-analysis',
  A08_INTEGRITY_FAILURES: 'owasp-A08-analysis',
  A09_LOGGING_FAILURES: 'owasp-A09-analysis',
  A10_SSRF: 'owasp-A10-analysis',
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
  const promptName = `owasp-${categoryCode}-analysis`;

  return getPrompt(
    { name: promptName, label },
    variables,
    `Analyze the code for ${categoryCode} vulnerabilities based on OWASP Top 10 2021.`
  );
}
