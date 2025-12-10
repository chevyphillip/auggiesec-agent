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

/**
 * Schema for parsed AUGMENT_SESSION_AUTH JSON
 * Validates structure at config load time (fail-fast)
 */
const SessionAuthSchema = z.object({
  accessToken: z.string().min(1, 'accessToken is required'),
  tenantURL: z.string().url('tenantURL must be a valid URL'),
  scopes: z.array(z.string()).optional(),
});

/**
 * Type for parsed session auth
 */
export type SessionAuth = z.infer<typeof SessionAuthSchema>;

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
    // Full JSON session token (recommended) - parsed and validated at load time
    sessionAuth: z.preprocess(
      (val) => {
        if (typeof val !== 'string' || !val) return undefined;
        try {
          return JSON.parse(val);
        } catch {
          // Return invalid value to let Zod report the error
          return { _parseError: true, raw: val };
        }
      },
      SessionAuthSchema.optional()
    ),
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

/**
 * Credentials for the Augment SDK
 * Derived from either sessionAuth or apiToken/apiUrl
 */
export interface AugmentCredentials {
  apiKey: string;
  apiUrl: string;
}

/**
 * Extract Augment SDK credentials from validated config.
 * Prefers sessionAuth (parsed JSON) over separated apiToken/apiUrl.
 *
 * @param config - Validated config from loadConfig()
 * @returns Credentials ready for Auggie SDK
 */
export function getAugmentCredentials(config: Config): AugmentCredentials {
  if (config.augment.sessionAuth) {
    return {
      apiKey: config.augment.sessionAuth.accessToken,
      apiUrl: config.augment.sessionAuth.tenantURL,
    };
  }
  // Safe to use non-null assertion because refine() ensures these exist
  // when sessionAuth is not provided
  return {
    apiKey: config.augment.apiToken!,
    apiUrl: config.augment.apiUrl!,
  };
}
