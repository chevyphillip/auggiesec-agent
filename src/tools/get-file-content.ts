/**
 * Get File Content Tool
 *
 * Reads file contents for detailed security analysis.
 * Used by analysis nodes to examine specific code sections.
 */

import { SpanStatusCode } from '@opentelemetry/api';
import { tool } from 'ai';
import * as fs from 'fs/promises';
import * as path from 'path';
import { z } from 'zod';
import { tracer } from '../instrumentation';

/**
 * Input schema for get_file_content tool
 */
export const getFileContentInputSchema = z.object({
  filePath: z
    .string()
    .describe('Path to file relative to workspace root (e.g., "routes/index.js")'),
  lineRange: z
    .object({
      start: z.number().optional().describe('Start line (1-indexed)'),
      end: z.number().optional().describe('End line (1-indexed, inclusive)'),
    })
    .optional()
    .describe('Optional line range to read'),
  workspaceRoot: z
    .string()
    .optional()
    .default('./nodejs-goof')
    .describe('Workspace root directory'),
});

export type GetFileContentInput = z.infer<typeof getFileContentInputSchema>;

/**
 * Result from file content read
 */
export interface GetFileContentResult {
  filePath: string;
  content: string;
  lineCount: number;
  lineRange?: { start: number; end: number };
  error?: string;
}

/**
 * Get file content tool definition
 *
 * Reads actual file contents from the filesystem.
 * Supports optional line range filtering.
 */
export const getFileContentTool = tool({
  description:
    'Read the contents of a specific file for detailed security analysis. Can optionally read only a specific line range.',
  inputSchema: getFileContentInputSchema,
  execute: async ({
    filePath,
    lineRange,
    workspaceRoot,
  }: GetFileContentInput): Promise<string> => {
    return tracer.startActiveSpan('tool.get_file_content', async (span) => {
      try {
        const fullPath = path.resolve(workspaceRoot || './nodejs-goof', filePath);

        span.setAttributes({
          'tool.name': 'get_file_content',
          'tool.filePath': filePath,
          'tool.fullPath': fullPath,
          'tool.lineRange.start': lineRange?.start || 0,
          'tool.lineRange.end': lineRange?.end || 0,
        });

        // Read file content
        let content: string;
        try {
          content = await fs.readFile(fullPath, 'utf-8');
        } catch (err) {
          const result: GetFileContentResult = {
            filePath,
            content: '',
            lineCount: 0,
            error: `File not found or unreadable: ${filePath}`,
          };
          span.setStatus({ code: SpanStatusCode.ERROR, message: result.error });
          return JSON.stringify(result, null, 2);
        }

        const lines = content.split('\n');
        let resultContent = content;
        let resultLineRange: { start: number; end: number } | undefined;

        // Apply line range filter if specified
        if (lineRange?.start || lineRange?.end) {
          const start = Math.max(1, lineRange.start || 1);
          const end = Math.min(lines.length, lineRange.end || lines.length);
          resultContent = lines.slice(start - 1, end).join('\n');
          resultLineRange = { start, end };
        }

        const result: GetFileContentResult = {
          filePath,
          content: resultContent,
          lineCount: lines.length,
          lineRange: resultLineRange,
        };

        span.setAttribute('tool.lineCount', result.lineCount);
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
