import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { ConfigSchema } from './config';

// Store original environment
const originalEnv = { ...process.env };

describe('ConfigSchema', () => {
  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
  });

  describe('valid configuration', () => {
    test('accepts valid Langfuse credentials', () => {
      const result = ConfigSchema.safeParse({
        langfuse: {
          publicKey: 'pk-lf-test123',
          secretKey: 'sk-lf-test456',
          host: 'https://cloud.langfuse.com',
        },
        augment: {},
        llm: {},
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.langfuse.publicKey).toBe('pk-lf-test123');
        expect(result.data.langfuse.secretKey).toBe('sk-lf-test456');
      }
    });

    test('applies default values', () => {
      const result = ConfigSchema.safeParse({
        langfuse: {
          publicKey: 'pk-lf-test',
          secretKey: 'sk-lf-test',
        },
        augment: {},
        llm: {},
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.langfuse.host).toBe('https://cloud.langfuse.com');
        expect(result.data.workspaceRoot).toBe('./nodejs-goof');
        expect(result.data.nodeEnv).toBe('development');
        expect(result.data.logLevel).toBe('info');
        expect(result.data.llm.provider).toBe('anthropic');
      }
    });

    test('accepts optional augment API key', () => {
      const result = ConfigSchema.safeParse({
        langfuse: {
          publicKey: 'pk-lf-test',
          secretKey: 'sk-lf-test',
        },
        augment: {
          apiKey: 'aug_test789',
        },
        llm: {},
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.augment.apiKey).toBe('aug_test789');
      }
    });

    test('accepts optional LLM API key', () => {
      const result = ConfigSchema.safeParse({
        langfuse: {
          publicKey: 'pk-lf-test',
          secretKey: 'sk-lf-test',
        },
        augment: {},
        llm: {
          provider: 'openai',
          apiKey: 'sk-openai-test',
        },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.llm.provider).toBe('openai');
        expect(result.data.llm.apiKey).toBe('sk-openai-test');
      }
    });
  });

  describe('invalid configuration', () => {
    test('rejects missing Langfuse public key', () => {
      const result = ConfigSchema.safeParse({
        langfuse: {
          secretKey: 'sk-lf-test',
        },
        augment: {},
        llm: {},
      });

      expect(result.success).toBe(false);
    });

    test('rejects missing Langfuse secret key', () => {
      const result = ConfigSchema.safeParse({
        langfuse: {
          publicKey: 'pk-lf-test',
        },
        augment: {},
        llm: {},
      });

      expect(result.success).toBe(false);
    });

    test('rejects invalid Langfuse public key prefix', () => {
      const result = ConfigSchema.safeParse({
        langfuse: {
          publicKey: 'invalid-key',
          secretKey: 'sk-lf-test',
        },
        augment: {},
        llm: {},
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const formatted = result.error.format();
        expect(formatted.langfuse?.publicKey?._errors).toBeDefined();
      }
    });

    test('rejects invalid Langfuse secret key prefix', () => {
      const result = ConfigSchema.safeParse({
        langfuse: {
          publicKey: 'pk-lf-test',
          secretKey: 'invalid-key',
        },
        augment: {},
        llm: {},
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const formatted = result.error.format();
        expect(formatted.langfuse?.secretKey?._errors).toBeDefined();
      }
    });

    test('rejects invalid Langfuse host URL', () => {
      const result = ConfigSchema.safeParse({
        langfuse: {
          publicKey: 'pk-lf-test',
          secretKey: 'sk-lf-test',
          host: 'not-a-url',
        },
        augment: {},
        llm: {},
      });

      expect(result.success).toBe(false);
    });

    test('rejects invalid augment API key prefix', () => {
      const result = ConfigSchema.safeParse({
        langfuse: {
          publicKey: 'pk-lf-test',
          secretKey: 'sk-lf-test',
        },
        augment: {
          apiKey: 'invalid-key',
        },
        llm: {},
      });

      expect(result.success).toBe(false);
    });

    test('rejects invalid nodeEnv value', () => {
      const result = ConfigSchema.safeParse({
        langfuse: {
          publicKey: 'pk-lf-test',
          secretKey: 'sk-lf-test',
        },
        augment: {},
        llm: {},
        nodeEnv: 'invalid',
      });

      expect(result.success).toBe(false);
    });

    test('rejects invalid logLevel value', () => {
      const result = ConfigSchema.safeParse({
        langfuse: {
          publicKey: 'pk-lf-test',
          secretKey: 'sk-lf-test',
        },
        augment: {},
        llm: {},
        logLevel: 'verbose',
      });

      expect(result.success).toBe(false);
    });

    test('rejects invalid LLM provider', () => {
      const result = ConfigSchema.safeParse({
        langfuse: {
          publicKey: 'pk-lf-test',
          secretKey: 'sk-lf-test',
        },
        augment: {},
        llm: {
          provider: 'gemini',
        },
      });

      expect(result.success).toBe(false);
    });
  });

  describe('environment variable mapping', () => {
    test('accepts all valid environment values', () => {
      const result = ConfigSchema.safeParse({
        langfuse: {
          publicKey: 'pk-lf-prod123',
          secretKey: 'sk-lf-prod456',
          host: 'https://us.cloud.langfuse.com',
        },
        augment: {
          apiKey: 'aug_production',
        },
        llm: {
          provider: 'anthropic',
          apiKey: 'sk-ant-production',
        },
        workspaceRoot: '/path/to/repo',
        nodeEnv: 'production',
        logLevel: 'warn',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.nodeEnv).toBe('production');
        expect(result.data.logLevel).toBe('warn');
        expect(result.data.workspaceRoot).toBe('/path/to/repo');
      }
    });
  });
});
