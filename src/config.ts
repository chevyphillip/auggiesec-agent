import { z } from 'zod';

/**
 * Configuration schema for OWASP GraphGuard
 *
 * Phase 1-3: Langfuse keys are REQUIRED
 * Phase 4+: Anthropic API key is REQUIRED for LLM-based analysis
 *
 * ## Augment SDK Authentication
 *
 * The Augment SDK supports multiple authentication methods (in priority order):
 * 1. **AUGMENT_SESSION_AUTH** - Full JSON token from `auggie token print`
 *    Format: `{"accessToken":"...","tenantURL":"...","scopes":["read","write"]}`
 * 2. **AUGMENT_API_TOKEN + AUGMENT_API_URL** - Separated credentials
 * 3. **~/.augment/session.json** - Automatic from `auggie login` (SDK fallback)
 *
 * At least one authentication method must be provided.
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
    // Full JSON session token (recommended)
    sessionAuth: z.string().optional(),
    // Separated credentials (alternative)
    apiToken: z.string().optional(),
    apiUrl: z.string().url().optional(),
  }).refine(
    (data) => {
      // At least one auth method must be provided
      return data.sessionAuth || (data.apiToken && data.apiUrl);
    },
    {
      message: 'Either AUGMENT_SESSION_AUTH or both AUGMENT_API_TOKEN and AUGMENT_API_URL must be provided',
    }
  ),
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
