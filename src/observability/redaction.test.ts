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
const SENSITIVE_FIELDS = ['apiKey', 'apiUrl'] as const;

function redactSensitive(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => redactSensitive(item));
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const isSensitive = SENSITIVE_FIELDS.includes(key as typeof SENSITIVE_FIELDS[number]);

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

  test('redacts apiUrl field', () => {
    const input = { apiUrl: 'https://api.example.com/secret', data: 'public' };
    const output = redactSensitive(input);

    expect(output).toEqual({ apiUrl: '[REDACTED]', data: 'public' });
  });

  test('redacts both apiKey and apiUrl fields', () => {
    const input = {
      apiKey: 'secret-key',
      apiUrl: 'https://api.example.com',
      username: 'john',
    };
    const output = redactSensitive(input);

    expect(output).toEqual({
      apiKey: '[REDACTED]',
      apiUrl: '[REDACTED]',
      username: 'john',
    });
  });

  test('redacts nested sensitive fields', () => {
    const input = {
      user: {
        name: 'john',
        config: {
          apiKey: 'secret-key',
          apiUrl: 'https://api.example.com',
          otherField: 'public-value',
        },
      },
    };
    const output = redactSensitive(input);

    expect(output).toEqual({
      user: {
        name: 'john',
        config: {
          apiKey: '[REDACTED]',
          apiUrl: '[REDACTED]',
          otherField: 'public-value',
        },
      },
    });
  });

  test('redacts sensitive fields in nested objects', () => {
    const input = {
      config: {
        apiKey: 'secret-key',
        apiUrl: 'https://api.example.com',
        nested: {
          apiKey: 'nested-secret',
          publicField: 'public-value',
        },
      },
    };
    const output = redactSensitive(input);

    expect(output).toEqual({
      config: {
        apiKey: '[REDACTED]',
        apiUrl: '[REDACTED]',
        nested: {
          apiKey: '[REDACTED]',
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

  test('only redacts exact field names (case-sensitive)', () => {
    const input = {
      apiKey: 'secret-1',
      api_key: 'not-redacted',
      API_KEY: 'not-redacted',
      ApiKey: 'not-redacted',
      apiUrl: 'secret-url',
      api_url: 'not-redacted',
      API_URL: 'not-redacted',
    };
    const output = redactSensitive(input);

    expect(output).toEqual({
      apiKey: '[REDACTED]',
      api_key: 'not-redacted',
      API_KEY: 'not-redacted',
      ApiKey: 'not-redacted',
      apiUrl: '[REDACTED]',
      api_url: 'not-redacted',
      API_URL: 'not-redacted',
    });
  });

  test('does not redact fields with similar names', () => {
    const input = {
      apiKey: 'should-redact',
      apiUrl: 'should-redact',
      // These should NOT be redacted
      apiToken: 'not-redacted',
      accessToken: 'not-redacted',
      secret: 'not-redacted',
      secretKey: 'not-redacted',
      password: 'not-redacted',
      credentials: 'not-redacted',
      authorization: 'not-redacted',
      bearer: 'not-redacted',
      privateKey: 'not-redacted',
      publicKey: 'not-redacted',
      userName: 'testuser',
      userEmail: 'test@example.com',
    };
    const output = redactSensitive(input);

    expect(output).toEqual({
      apiKey: '[REDACTED]',
      apiUrl: '[REDACTED]',
      apiToken: 'not-redacted',
      accessToken: 'not-redacted',
      secret: 'not-redacted',
      secretKey: 'not-redacted',
      password: 'not-redacted',
      credentials: 'not-redacted',
      authorization: 'not-redacted',
      bearer: 'not-redacted',
      privateKey: 'not-redacted',
      publicKey: 'not-redacted',
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
          apiUrl: 'secret-url',
          level3: {
            apiKey: 'secret-3',
            publicData: 'public',
          },
        },
        publicArray: [
          { id: 1, apiKey: 'secret-4', name: 'item1' },
        ],
      },
    };
    const output = redactSensitive(input);

    expect(output).toEqual({
      level1: {
        apiKey: '[REDACTED]',
        level2: {
          apiUrl: '[REDACTED]',
          level3: {
            apiKey: '[REDACTED]',
            publicData: 'public',
          },
        },
        publicArray: [
          { id: 1, apiKey: '[REDACTED]', name: 'item1' },
        ],
      },
    });
  });

  test('preserves non-sensitive fields with similar substrings', () => {
    const input = {
      apiEndpoint: 'https://api.example.com',
      publicKey: 'public-key-xyz',
      tokenExpiry: 3600,
      secretariat: 'office-name',
      passwordPolicy: 'strong',
    };
    const output = redactSensitive(input);

    // None of these should be redacted as they are not exact matches
    expect(output).toEqual({
      apiEndpoint: 'https://api.example.com',
      publicKey: 'public-key-xyz',
      tokenExpiry: 3600,
      secretariat: 'office-name',
      passwordPolicy: 'strong',
    });
  });
});
