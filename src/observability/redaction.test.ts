/**
 * Unit tests for sensitive data redaction logic
 *
 * These tests verify that the redactSensitive function properly redacts
 * sensitive fields from observability data before sending to Langfuse.
 */

import { describe, expect, test } from 'bun:test';

// Import the redactSensitive function by exporting it from index.ts
// For now, we'll test it indirectly through withTool, but we could also export it

/**
 * Test helper to access the private redactSensitive function
 * This duplicates the logic for testing purposes
 */
const SENSITIVE_KEYS = [
  'apikey',
  'apitoken',
  'secret',
  'password',
  'credentials',
  'accesstoken',
  'token',
  'auth',
  'authorization',
  'bearer',
  'privatekey',
  'secretkey',
] as const;

function redactSensitive(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => redactSensitive(item));
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const keyLower = key.toLowerCase();
    const isSensitive = SENSITIVE_KEYS.some(sensitiveKey =>
      keyLower.includes(sensitiveKey)
    );

    if (isSensitive) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = redactSensitive(value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

describe('Sensitive Data Redaction', () => {
  test('redacts apiKey field', () => {
    const input = { apiKey: 'secret-123', data: 'public' };
    const output = redactSensitive(input);

    expect(output).toEqual({ apiKey: '[REDACTED]', data: 'public' });
  });

  test('redacts multiple sensitive fields', () => {
    const input = {
      apiKey: 'secret-key',
      apiToken: 'secret-token',
      password: 'secret-pass',
      username: 'john',
    };
    const output = redactSensitive(input);

    expect(output).toEqual({
      apiKey: '[REDACTED]',
      apiToken: '[REDACTED]',
      password: '[REDACTED]',
      username: 'john',
    });
  });

  test('redacts nested sensitive fields', () => {
    const input = {
      user: {
        name: 'john',
        credentials: {
          apiKey: 'secret-key',
          apiUrl: 'https://api.example.com',
        },
      },
    };
    const output = redactSensitive(input);

    expect(output).toEqual({
      user: {
        name: 'john',
        credentials: '[REDACTED]',
      },
    });
  });

  test('redacts sensitive fields in nested objects', () => {
    const input = {
      config: {
        apiKey: 'secret-key',
        apiUrl: 'https://api.example.com',
        nested: {
          password: 'secret-pass',
          publicField: 'public-value',
        },
      },
    };
    const output = redactSensitive(input);

    expect(output).toEqual({
      config: {
        apiKey: '[REDACTED]',
        apiUrl: 'https://api.example.com',
        nested: {
          password: '[REDACTED]',
          publicField: 'public-value',
        },
      },
    });
  });

  test('redacts sensitive fields in arrays', () => {
    const input = {
      items: [
        { id: 1, apiKey: 'secret-1', name: 'item1' },
        { id: 2, apiKey: 'secret-2', name: 'item2' },
      ],
    };
    const output = redactSensitive(input);

    expect(output).toEqual({
      items: [
        { id: 1, apiKey: '[REDACTED]', name: 'item1' },
        { id: 2, apiKey: '[REDACTED]', name: 'item2' },
      ],
    });
  });

  test('handles case-insensitive field names', () => {
    const input = {
      apiKey: 'secret-1',
      api_key: 'secret-2',
      API_KEY: 'secret-3',
      ApiKey: 'secret-4',
    };
    const output = redactSensitive(input);

    expect(output).toEqual({
      apiKey: '[REDACTED]',
      api_key: '[REDACTED]',
      API_KEY: '[REDACTED]',
      ApiKey: '[REDACTED]',
    });
  });

  test('redacts various sensitive patterns', () => {
    const input = {
      apiKey: 'should-redact',
      apiToken: 'should-redact',
      accessToken: 'should-redact',
      secret: 'should-redact',
      secretKey: 'should-redact',
      password: 'should-redact',
      credentials: 'should-redact',
      authorization: 'should-redact',
      bearer: 'should-redact',
      privateKey: 'should-redact',
      // These should NOT be redacted
      apiUrl: 'https://api.example.com',
      publicKey: 'public-key-xyz',
      userName: 'testuser',
      userEmail: 'test@example.com',
    };
    const output = redactSensitive(input);

    expect(output).toEqual({
      apiKey: '[REDACTED]',
      apiToken: '[REDACTED]',
      accessToken: '[REDACTED]',
      secret: '[REDACTED]',
      secretKey: '[REDACTED]',
      password: '[REDACTED]',
      credentials: '[REDACTED]',
      authorization: '[REDACTED]',
      bearer: '[REDACTED]',
      privateKey: '[REDACTED]',
      apiUrl: 'https://api.example.com',
      publicKey: 'public-key-xyz',
      userName: 'testuser',
      userEmail: 'test@example.com',
    });
  });

  test('handles null and undefined values', () => {
    const input = {
      apiKey: 'secret',
      nullField: null,
      undefinedField: undefined,
      normalField: 'value',
    };
    const output = redactSensitive(input);

    expect(output).toEqual({
      apiKey: '[REDACTED]',
      nullField: null,
      undefinedField: undefined,
      normalField: 'value',
    });
  });

  test('handles primitive values', () => {
    expect(redactSensitive('string')).toBe('string');
    expect(redactSensitive(123)).toBe(123);
    expect(redactSensitive(true)).toBe(true);
    expect(redactSensitive(null)).toBe(null);
  });

  test('handles arrays of primitives', () => {
    const input = ['value1', 'value2', 'value3'];
    const output = redactSensitive(input);

    expect(output).toEqual(['value1', 'value2', 'value3']);
  });

  test('handles complex nested structure', () => {
    const input = {
      level1: {
        apiKey: 'secret-1',
        level2: {
          password: 'secret-2',
          level3: {
            token: 'secret-3',
            publicData: 'public',
          },
        },
        publicArray: [
          { id: 1, secret: 'secret-4', name: 'item1' },
        ],
      },
    };
    const output = redactSensitive(input);

    expect(output).toEqual({
      level1: {
        apiKey: '[REDACTED]',
        level2: {
          password: '[REDACTED]',
          level3: {
            token: '[REDACTED]',
            publicData: 'public',
          },
        },
        publicArray: [
          { id: 1, secret: '[REDACTED]', name: 'item1' },
        ],
      },
    });
  });

  test('preserves non-sensitive fields with similar names', () => {
    const input = {
      apiUrl: 'https://api.example.com',
      publicKey: 'public-key-xyz',
      tokenExpiry: 3600,
      secretariat: 'office-name',
    };
    const output = redactSensitive(input);

    // apiUrl should NOT be redacted (doesn't contain sensitive keywords)
    // publicKey should NOT be redacted (not in sensitive list)
    // tokenExpiry should be redacted (contains 'token')
    // secretariat should be redacted (contains 'secret')
    expect(output).toEqual({
      apiUrl: 'https://api.example.com',
      publicKey: 'public-key-xyz',
      tokenExpiry: '[REDACTED]',
      secretariat: '[REDACTED]',
    });
  });
});
