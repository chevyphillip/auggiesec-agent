/**
 * Unit tests for sensitive data redaction in observability
 */

import { describe, expect, test } from 'bun:test';
import { redactSensitive } from './index';

describe('redactSensitive', () => {
  test('redacts sensitive fields in flat objects', () => {
    const input = {
      apiKey: 'secret-key-123',
      apiUrl: 'https://api.example.com',
      password: 'secret-pass',
      username: 'testuser',
    };
    const output = redactSensitive(input);

    expect(output).toEqual({
      apiKey: '[REDACTED]',
      apiUrl: 'https://api.example.com',
      password: '[REDACTED]',
      username: 'testuser',
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
      APIKEY: 'secret-2',
      ApiKey: 'secret-3',
      apikey: 'secret-4',
    };
    const output = redactSensitive(input);

    expect(output).toEqual({
      apiKey: '[REDACTED]',
      APIKEY: '[REDACTED]',
      ApiKey: '[REDACTED]',
      apikey: '[REDACTED]',
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
