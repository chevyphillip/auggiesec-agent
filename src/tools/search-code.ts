/**
 * Search Code Tool
 *
 * Searches the codebase for security-relevant patterns using Auggie SDK.
 * Used by analysis nodes to find potential vulnerabilities.
 */

import { SpanStatusCode } from '@opentelemetry/api';
import { tool } from 'ai';
import { z } from 'zod';
import { tracer } from '../instrumentation';

/**
 * Input schema for search_code tool
 */
export const searchCodeInputSchema = z.object({
  query: z
    .string()
    .describe(
      'Search query for code patterns (e.g., "exec(", "eval(", "User.find", "password")'
    ),
  filePattern: z
    .string()
    .optional()
    .describe('Glob pattern to filter files (e.g., "**/*.js", "routes/**")'),
  maxResults: z
    .number()
    .optional()
    .default(20)
    .describe('Maximum number of results to return'),
});

export type SearchCodeInput = z.infer<typeof searchCodeInputSchema>;

/**
 * Result from code search
 */
export interface SearchCodeResult {
  matches: Array<{
    file: string;
    line: number;
    content: string;
    context?: string;
  }>;
  totalMatches: number;
  truncated: boolean;
}

/**
 * Search code tool definition
 *
 * In Phase 4+, this will use Auggie SDK's code search capabilities.
 * For now, it provides a placeholder implementation.
 */
export const searchCodeTool = tool({
  description:
    'Search the codebase for code patterns, function calls, or keywords. Use this to find potential security vulnerabilities like exec(), eval(), SQL queries, or user input handling.',
  inputSchema: searchCodeInputSchema,
  execute: async ({ query, filePattern, maxResults }: SearchCodeInput): Promise<string> => {
    return tracer.startActiveSpan('tool.search_code', async (span) => {
      try {
        span.setAttributes({
          'tool.name': 'search_code',
          'tool.query': query,
          'tool.filePattern': filePattern || '*',
          'tool.maxResults': maxResults || 20,
        });

        // Phase 4: Will use Auggie SDK
        // const client = await Auggie.create({ workspaceRoot: repoPath });
        // const results = await client.searchCode(query, { filePattern });

        // Placeholder implementation for Phase 3
        const result: SearchCodeResult = {
          matches: [
            {
              file: 'routes/index.js',
              line: 39,
              content:
                "User.find({ username: req.body.username, password: req.body.password })",
              context: 'Login handler - potential NoSQL injection',
            },
            {
              file: 'routes/index.js',
              line: 160,
              content: "exec('ping -c 2 ' + req.body.address)",
              context: 'Network utility - command injection risk',
            },
          ],
          totalMatches: 2,
          truncated: false,
        };

        span.setAttribute('tool.matches', result.totalMatches);
        span.setStatus({ code: SpanStatusCode.OK });

        return JSON.stringify(result, null, 2);
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: String(error),
        });
        span.recordException(error as Error);
        throw error;
      } finally {
        span.end();
      }
    });
  },
});
