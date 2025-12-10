import { z } from 'zod';

/**
 * Configuration schema for OWASP GraphGuard
 *
 * Phase 1-3: Langfuse keys are REQUIRED
 * Phase 4+: Anthropic API key is REQUIRED for LLM-based analysis
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
    sessionAuth: z.string().optional(), // Full JSON token from `auggie token print`
    apiToken: z.string().optional(), // Separated API token
    apiUrl: z.string().url().optional(), // API URL
  }),
  llm: z.object({
    provider: z.enum(['anthropic', 'openai']).default('anthropic'),
    apiKey: z.string().startsWith('sk-ant-', {
      message: 'ANTHROPIC_API_KEY must start with "sk-ant-"',
    }),
    model: z.string().default('claude-sonnet-4-5-20250929'),
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
      sessionAuth: process.env.AUGMENT_SESSION_AUTH,
      apiToken: process.env.AUGMENT_API_TOKEN,
      apiUrl: process.env.AUGMENT_API_URL,
    },
    llm: {
      provider: process.env.LLM_PROVIDER,
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.LLM_MODEL,
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
