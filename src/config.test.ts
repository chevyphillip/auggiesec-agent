import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
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
    test('accepts valid Langfuse and Anthropic credentials with session auth', () => {
      const result = ConfigSchema.safeParse({
        langfuse: {
          publicKey: 'pk-lf-test123',
          secretKey: 'sk-lf-test456',
          host: 'https://cloud.langfuse.com',
        },
        augment: {
          sessionAuth: '{"accessToken":"test-token","tenantURL":"https://test.api.augmentcode.com"}',
        },
        llm: {
          apiKey: 'sk-ant-test789',
        },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.langfuse.publicKey).toBe('pk-lf-test123');
        expect(result.data.langfuse.secretKey).toBe('sk-lf-test456');
        expect(result.data.llm.apiKey).toBe('sk-ant-test789');
        expect(result.data.augment.sessionAuth).toBeDefined();
      }
    });

    test('accepts valid Langfuse and Anthropic credentials with separated auth', () => {
      const result = ConfigSchema.safeParse({
        langfuse: {
          publicKey: 'pk-lf-test123',
          secretKey: 'sk-lf-test456',
          host: 'https://cloud.langfuse.com',
        },
        augment: {
          apiToken: 'test-access-token',
          apiUrl: 'https://test.api.augmentcode.com',
        },
        llm: {
          apiKey: 'sk-ant-test789',
        },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.augment.apiToken).toBe('test-access-token');
        expect(result.data.augment.apiUrl).toBe('https://test.api.augmentcode.com');
      }
    });

    test('applies default values', () => {
      const result = ConfigSchema.safeParse({
        langfuse: {
          publicKey: 'pk-lf-test',
          secretKey: 'sk-lf-test',
        },
        augment: {
          sessionAuth: '{"accessToken":"test","tenantURL":"https://test.api.augmentcode.com"}',
        },
        llm: {
          apiKey: 'sk-ant-test',
        },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.langfuse.host).toBe('https://cloud.langfuse.com');
        expect(result.data.workspaceRoot).toBe('./nodejs-goof');
        expect(result.data.nodeEnv).toBe('development');
        expect(result.data.logLevel).toBe('info');
        expect(result.data.llm.provider).toBe('anthropic');
        expect(result.data.llm.model).toBe('claude-sonnet-4-5-20250929');
      }
    });

    test('accepts custom LLM model', () => {
      const result = ConfigSchema.safeParse({
        langfuse: {
          publicKey: 'pk-lf-test',
          secretKey: 'sk-lf-test',
        },
        augment: {
          sessionAuth: '{"accessToken":"test","tenantURL":"https://test.api.augmentcode.com"}',
        },
        llm: {
          provider: 'anthropic',
          apiKey: 'sk-ant-test',
          model: 'claude-opus-4-5-20251101',
        },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.llm.provider).toBe('anthropic');
        expect(result.data.llm.apiKey).toBe('sk-ant-test');
        expect(result.data.llm.model).toBe('claude-opus-4-5-20251101');
      }
    });
  });

  describe('invalid configuration', () => {
    test('rejects missing Langfuse public key', () => {
      const result = ConfigSchema.safeParse({
        langfuse: {
          secretKey: 'sk-lf-test',
        },
        augment: {
          sessionAuth: '{"accessToken":"test","tenantURL":"https://test.api.augmentcode.com"}',
        },
        llm: { apiKey: 'sk-ant-test' },
      });

      expect(result.success).toBe(false);
    });

    test('rejects missing Langfuse secret key', () => {
      const result = ConfigSchema.safeParse({
        langfuse: {
          publicKey: 'pk-lf-test',
        },
        augment: {
          sessionAuth: '{"accessToken":"test","tenantURL":"https://test.api.augmentcode.com"}',
        },
        llm: { apiKey: 'sk-ant-test' },
      });

      expect(result.success).toBe(false);
    });

    test('rejects invalid Langfuse public key prefix', () => {
      const result = ConfigSchema.safeParse({
        langfuse: {
          publicKey: 'invalid-key',
          secretKey: 'sk-lf-test',
        },
        augment: {
          sessionAuth: '{"accessToken":"test","tenantURL":"https://test.api.augmentcode.com"}',
        },
        llm: { apiKey: 'sk-ant-test' },
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
        augment: {
          sessionAuth: '{"accessToken":"test","tenantURL":"https://test.api.augmentcode.com"}',
        },
        llm: { apiKey: 'sk-ant-test' },
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
        augment: {
          sessionAuth: '{"accessToken":"test","tenantURL":"https://test.api.augmentcode.com"}',
        },
        llm: { apiKey: 'sk-ant-test' },
      });

      expect(result.success).toBe(false);
    });

    test('rejects missing augment credentials', () => {
      const result = ConfigSchema.safeParse({
        langfuse: {
          publicKey: 'pk-lf-test',
          secretKey: 'sk-lf-test',
        },
        augment: {
          // No sessionAuth, apiToken, or apiUrl
        },
        llm: { apiKey: 'sk-ant-test' },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const formatted = result.error.format();
        expect(formatted.augment?._errors).toBeDefined();
      }
    });

    test('rejects incomplete separated augment credentials (token only)', () => {
      const result = ConfigSchema.safeParse({
        langfuse: {
          publicKey: 'pk-lf-test',
          secretKey: 'sk-lf-test',
        },
        augment: {
          apiToken: 'test-token',
          // Missing apiUrl
        },
        llm: { apiKey: 'sk-ant-test' },
      });

      expect(result.success).toBe(false);
    });

    test('rejects incomplete separated augment credentials (URL only)', () => {
      const result = ConfigSchema.safeParse({
        langfuse: {
          publicKey: 'pk-lf-test',
          secretKey: 'sk-lf-test',
        },
        augment: {
          // Missing apiToken
          apiUrl: 'https://test.api.augmentcode.com',
        },
        llm: { apiKey: 'sk-ant-test' },
      });

      expect(result.success).toBe(false);
    });

    test('rejects invalid augment API URL', () => {
      const result = ConfigSchema.safeParse({
        langfuse: {
          publicKey: 'pk-lf-test',
          secretKey: 'sk-lf-test',
        },
        augment: {
          apiToken: 'test-token',
          apiUrl: 'not-a-valid-url',
        },
        llm: { apiKey: 'sk-ant-test' },
      });

      expect(result.success).toBe(false);
    });

    test('rejects invalid JSON in sessionAuth', () => {
      const result = ConfigSchema.safeParse({
        langfuse: {
          publicKey: 'pk-lf-test',
          secretKey: 'sk-lf-test',
        },
        augment: {
          sessionAuth: 'not-valid-json',
        },
        llm: { apiKey: 'sk-ant-test' },
      });

      expect(result.success).toBe(false);
    });

    test('rejects sessionAuth missing accessToken', () => {
      const result = ConfigSchema.safeParse({
        langfuse: {
          publicKey: 'pk-lf-test',
          secretKey: 'sk-lf-test',
        },
        augment: {
          sessionAuth: '{"tenantURL":"https://test.api.augmentcode.com"}',
        },
        llm: { apiKey: 'sk-ant-test' },
      });

      expect(result.success).toBe(false);
    });

    test('rejects sessionAuth missing tenantURL', () => {
      const result = ConfigSchema.safeParse({
        langfuse: {
          publicKey: 'pk-lf-test',
          secretKey: 'sk-lf-test',
        },
        augment: {
          sessionAuth: '{"accessToken":"test-token"}',
        },
        llm: { apiKey: 'sk-ant-test' },
      });

      expect(result.success).toBe(false);
    });

    test('rejects sessionAuth with invalid tenantURL', () => {
      const result = ConfigSchema.safeParse({
        langfuse: {
          publicKey: 'pk-lf-test',
          secretKey: 'sk-lf-test',
        },
        augment: {
          sessionAuth: '{"accessToken":"test-token","tenantURL":"not-a-url"}',
        },
        llm: { apiKey: 'sk-ant-test' },
      });

      expect(result.success).toBe(false);
    });

    test('rejects sessionAuth with empty accessToken', () => {
      const result = ConfigSchema.safeParse({
        langfuse: {
          publicKey: 'pk-lf-test',
          secretKey: 'sk-lf-test',
        },
        augment: {
          sessionAuth: '{"accessToken":"","tenantURL":"https://test.api.augmentcode.com"}',
        },
        llm: { apiKey: 'sk-ant-test' },
      });

      expect(result.success).toBe(false);
    });

    test('rejects missing Anthropic API key', () => {
      const result = ConfigSchema.safeParse({
        langfuse: {
          publicKey: 'pk-lf-test',
          secretKey: 'sk-lf-test',
        },
        augment: {
          sessionAuth: '{"accessToken":"test","tenantURL":"https://test.api.augmentcode.com"}',
        },
        llm: {},
      });

      expect(result.success).toBe(false);
    });

    test('rejects invalid Anthropic API key prefix', () => {
      const result = ConfigSchema.safeParse({
        langfuse: {
          publicKey: 'pk-lf-test',
          secretKey: 'sk-lf-test',
        },
        augment: {
          sessionAuth: '{"accessToken":"test","tenantURL":"https://test.api.augmentcode.com"}',
        },
        llm: { apiKey: 'invalid-key' },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const formatted = result.error.format();
        expect(formatted.llm?.apiKey?._errors).toBeDefined();
      }
    });

    test('rejects invalid nodeEnv value', () => {
      const result = ConfigSchema.safeParse({
        langfuse: {
          publicKey: 'pk-lf-test',
          secretKey: 'sk-lf-test',
        },
        augment: {
          sessionAuth: '{"accessToken":"test","tenantURL":"https://test.api.augmentcode.com"}',
        },
        llm: { apiKey: 'sk-ant-test' },
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
        augment: {
          sessionAuth: '{"accessToken":"test","tenantURL":"https://test.api.augmentcode.com"}',
        },
        llm: { apiKey: 'sk-ant-test' },
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
        augment: {
          sessionAuth: '{"accessToken":"test","tenantURL":"https://test.api.augmentcode.com"}',
        },
        llm: {
          provider: 'gemini',
          apiKey: 'sk-ant-test',
        },
      });

      expect(result.success).toBe(false);
    });
  });

  describe('environment variable mapping', () => {
    test('accepts all valid environment values with session auth', () => {
      const result = ConfigSchema.safeParse({
        langfuse: {
          publicKey: 'pk-lf-prod123',
          secretKey: 'sk-lf-prod456',
          host: 'https://us.cloud.langfuse.com',
        },
        augment: {
          sessionAuth: '{"accessToken":"prod-token","tenantURL":"https://prod.api.augmentcode.com"}',
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

    test('accepts all valid environment values with separated auth', () => {
      const result = ConfigSchema.safeParse({
        langfuse: {
          publicKey: 'pk-lf-prod123',
          secretKey: 'sk-lf-prod456',
          host: 'https://us.cloud.langfuse.com',
        },
        augment: {
          apiToken: 'prod-access-token',
          apiUrl: 'https://prod.api.augmentcode.com',
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
        expect(result.data.augment.apiToken).toBe('prod-access-token');
        expect(result.data.augment.apiUrl).toBe('https://prod.api.augmentcode.com');
      }
    });
  });
});
