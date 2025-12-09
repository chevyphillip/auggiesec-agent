/**
 * Analyze Dependencies Tool
 *
 * Analyzes package.json for known vulnerable dependencies.
 * Used by A06:2021-Vulnerable and Outdated Components analysis.
 */

import { SpanStatusCode } from '@opentelemetry/api';
import { tool } from 'ai';
import * as fs from 'fs/promises';
import * as path from 'path';
import { z } from 'zod';
import { tracer } from '../instrumentation';

/**
 * Input schema for analyze_dependencies tool
 */
export const analyzeDependenciesInputSchema = z.object({
  manifestPath: z
    .string()
    .optional()
    .default('package.json')
    .describe('Path to package manifest (default: package.json)'),
  workspaceRoot: z
    .string()
    .optional()
    .default('./nodejs-goof')
    .describe('Workspace root directory'),
});

export type AnalyzeDependenciesInput = z.infer<typeof analyzeDependenciesInputSchema>;

/**
 * Vulnerability info for a dependency
 */
export interface DependencyVulnerability {
  package: string;
  version: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  cve?: string;
  description: string;
  recommendation: string;
}

/**
 * Result from dependency analysis
 */
export interface AnalyzeDependenciesResult {
  manifestPath: string;
  totalDependencies: number;
  vulnerabilities: DependencyVulnerability[];
  error?: string;
}

// Known vulnerable packages in nodejs-goof (for demonstration)
const KNOWN_VULNERABILITIES: Record<string, Omit<DependencyVulnerability, 'package' | 'version'>> = {
  'dustjs-linkedin': {
    severity: 'critical',
    cve: 'CVE-2021-32820',
    description: 'Prototype pollution vulnerability allowing arbitrary code execution',
    recommendation: 'Upgrade to dustjs-linkedin@3.0.0 or later',
  },
  'marked': {
    severity: 'high',
    cve: 'CVE-2022-21680',
    description: 'Regular expression denial of service (ReDoS)',
    recommendation: 'Upgrade to marked@4.0.10 or later',
  },
  'mongoose': {
    severity: 'medium',
    description: 'Older versions may have prototype pollution vulnerabilities',
    recommendation: 'Upgrade to mongoose@6.0.0 or later',
  },
  'st': {
    severity: 'high',
    cve: 'CVE-2017-16224',
    description: 'Directory traversal vulnerability',
    recommendation: 'Upgrade to st@1.2.2 or later',
  },
  'ms': {
    severity: 'medium',
    cve: 'CVE-2017-20162',
    description: 'ReDoS vulnerability in older versions',
    recommendation: 'Upgrade to ms@2.1.3 or later',
  },
};

/**
 * Analyze dependencies tool definition
 *
 * Reads package.json and checks for known vulnerable packages.
 */
export const analyzeDependenciesTool = tool({
  description:
    'Analyze package.json for known vulnerable dependencies. Returns a list of packages with known security issues.',
  inputSchema: analyzeDependenciesInputSchema,
  execute: async ({ manifestPath, workspaceRoot }: AnalyzeDependenciesInput): Promise<string> => {
    return tracer.startActiveSpan('tool.analyze_dependencies', async (span) => {
      try {
        const fullPath = path.resolve(workspaceRoot || './nodejs-goof', manifestPath || 'package.json');

        span.setAttributes({
          'tool.name': 'analyze_dependencies',
          'tool.manifestPath': manifestPath || 'package.json',
          'tool.fullPath': fullPath,
        });

        // Read package.json
        let packageJson: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
        try {
          const content = await fs.readFile(fullPath, 'utf-8');
          packageJson = JSON.parse(content);
        } catch (err) {
          const result: AnalyzeDependenciesResult = {
            manifestPath: manifestPath || 'package.json',
            totalDependencies: 0,
            vulnerabilities: [],
            error: `Failed to read or parse ${manifestPath}: ${err}`,
          };
          span.setStatus({ code: SpanStatusCode.ERROR, message: result.error });
          return JSON.stringify(result, null, 2);
        }

        const allDeps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
        };

        const vulnerabilities: DependencyVulnerability[] = [];

        // Check each dependency against known vulnerabilities
        for (const [pkg, version] of Object.entries(allDeps)) {
          if (KNOWN_VULNERABILITIES[pkg]) {
            vulnerabilities.push({
              package: pkg,
              version: version || 'unknown',
              ...KNOWN_VULNERABILITIES[pkg],
            });
          }
        }

        const result: AnalyzeDependenciesResult = {
          manifestPath: manifestPath || 'package.json',
          totalDependencies: Object.keys(allDeps).length,
          vulnerabilities,
        };

        span.setAttribute('tool.totalDependencies', result.totalDependencies);
        span.setAttribute('tool.vulnerabilities', vulnerabilities.length);
        span.setStatus({ code: SpanStatusCode.OK });

        return JSON.stringify(result, null, 2);
      } catch (error) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
        span.recordException(error as Error);
        throw error;
      } finally {
        span.end();
      }
    });
  },
});
