import { z } from 'zod';

/**
 * Configuration schema for OWASP GraphGuard
 *
 * Phase 1: Langfuse keys are REQUIRED
 * Phase 2+: Auggie and LLM keys will be REQUIRED
 */
const ConfigSchema = z.object({
  langfuse: z.object({
    publicKey: z.string().startsWith('pk-lf-', {
      message: 'LANGFUSE_PUBLIC_KEY must start with "pk-lf-"',
    }),
    secretKey: z.string().startsWith('sk-lf-', {
      message: 'LANGFUSE_SECRET_KEY must start with "sk-lf-"',
    }),
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

/**
 * Load and validate configuration from environment variables.
 * Exits with code 1 if validation fails (fail fast).
 */
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

// Export schema for testing
export { ConfigSchema };
