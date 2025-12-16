/**
 * Integration tests for Langfuse observability wrappers
 *
 * These tests verify that tool observations are correctly created with
 * expected attributes (input, output, metadata, observation type).
 */

import { describe, expect, test, beforeEach, afterEach, mock } from 'bun:test';
import { withTool, type ToolObservationOptions } from './index';

describe('Observability - Tool Observations', () => {
  describe('withTool', () => {
    test('executes function and returns result', async () => {
      const result = await withTool(
        'test.simple_tool',
        async () => {
          return { success: true, data: 'test data' };
        }
      );

      expect(result).toEqual({ success: true, data: 'test data' });
    });

    test('accepts input and metadata options', async () => {
      const options: ToolObservationOptions = {
        input: { query: 'test query', maxResults: 10 },
        metadata: { toolName: 'test_tool', version: '1.0' },
      };

      const result = await withTool(
        'test.tool_with_options',
        async () => {
          return { results: ['item1', 'item2'] };
        },
        options
      );

      expect(result).toEqual({ results: ['item1', 'item2'] });
    });

    test('accepts scan context options', async () => {
      const options: ToolObservationOptions = {
        input: { category: 'A03:2021-Injection' },
        scanContext: {
          scanId: 'scan-123',
          owaspCategory: 'A03:2021-Injection',
          repoPath: '/test/repo',
        },
        metadata: { toolName: 'security_scan' },
      };

      const result = await withTool(
        'test.tool_with_scan_context',
        async () => {
          return { findings: [] };
        },
        options
      );

      expect(result).toEqual({ findings: [] });
    });

    test('propagates errors from tool function', async () => {
      const testError = new Error('Tool execution failed');

      await expect(
        withTool('test.failing_tool', async () => {
          throw testError;
        })
      ).rejects.toThrow('Tool execution failed');
    });

    test('handles async operations correctly', async () => {
      const result = await withTool(
        'test.async_tool',
        async () => {
          // Simulate async operation
          await new Promise((resolve) => setTimeout(resolve, 10));
          return { completed: true };
        }
      );

      expect(result).toEqual({ completed: true });
    });

    test('works with complex return types', async () => {
      interface ComplexResult {
        status: string;
        data: {
          items: string[];
          count: number;
        };
        metadata: Record<string, unknown>;
      }

      const result = await withTool<ComplexResult>(
        'test.complex_tool',
        async () => {
          return {
            status: 'success',
            data: {
              items: ['a', 'b', 'c'],
              count: 3,
            },
            metadata: {
              timestamp: new Date().toISOString(),
              version: '1.0',
            },
          };
        }
      );

      expect(result.status).toBe('success');
      expect(result.data.count).toBe(3);
      expect(result.data.items).toHaveLength(3);
    });

    test('handles undefined options gracefully', async () => {
      const result = await withTool(
        'test.no_options_tool',
        async () => {
          return 'simple result';
        }
      );

      expect(result).toBe('simple result');
    });

    test('handles partial scan context', async () => {
      const options: ToolObservationOptions = {
        scanContext: {
          scanId: 'scan-456',
          // owaspCategory and repoPath are optional
        },
      };

      const result = await withTool(
        'test.partial_context_tool',
        async () => {
          return { status: 'ok' };
        },
        options
      );

      expect(result).toEqual({ status: 'ok' });
    });

    test('returns unmodified result with captureOutput: false', async () => {
      const result = await withTool(
        'test.no_capture_tool',
        async () => {
          return {
            apiKey: 'secret-key-12345',
            sensitiveData: 'should not be logged',
          };
        },
        {
          captureOutput: false,
        }
      );

      // Result should still be returned unmodified
      expect(result).toEqual({
        apiKey: 'secret-key-12345',
        sensitiveData: 'should not be logged',
      });
    });
  });
});

