/**
 * Auggie-based Security Analysis
 *
 * Uses the Auggie SDK as the orchestrator for security analysis.
 * Auggie handles: codebase indexing, LLM calls, and tool execution.
 *
 * ## Authentication
 *
 * Credentials are passed from the centralized config system (src/config.ts).
 * The config system validates credentials at load time using Zod schemas.
 *
 * @module tools/auggie-analysis
 */

import { APIError, Auggie, BlobTooLargeError } from '@augmentcode/auggie-sdk';
import { SpanStatusCode } from '@opentelemetry/api';
import type { AugmentCredentials } from '../config';
import type { OwaspCategory, SecurityFinding } from '../graph/state';
import { tracer } from '../instrumentation';
import { withAgent } from '../observability';
import { getOwaspPrompt } from './langfuse-prompts';
import {
    clearFindings
} from './report-vulnerability';

export type AuggieModel = 'haiku4.5' | 'sonnet4.5' | 'sonnet4' | 'gpt5';

export interface AuggieAnalysisOptions {
  /** Path to the repository to analyze */
  repoPath: string;
  /** OWASP category to analyze for */
  category: OwaspCategory;
  /** Scan ID for tracing */
  scanId: string;
  /** Model to use (default: sonnet4.5) */
  model?: AuggieModel;
  /** Augment SDK credentials from validated config */
  credentials: AugmentCredentials;
}

/**
 * Extract category code from full OWASP category string
 * e.g., 'A03:2021-Injection' -> 'A03'
 */
function getCategoryCode(category: OwaspCategory): string {
  return category.split(':')[0] ?? 'A00';
}

/**
 * Parse Auggie's response to extract security findings
 * Handles both JSON and markdown-wrapped JSON responses
 */
function parseAuggieResponse(
  response: string,
  category: OwaspCategory
): SecurityFinding[] {
  try {
    // Try to extract JSON from the response
    // First, try to find JSON in code blocks
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1]?.trim() : response.trim();

    if (!jsonStr) {
      console.log('[auggie] No JSON content found in response');
      return [];
    }

    // Parse the JSON
    const parsed = JSON.parse(jsonStr);
    const rawFindings = parsed.findings || parsed;

    if (!Array.isArray(rawFindings)) {
      console.log('[auggie] Response is not an array of findings');
      return [];
    }

    // Convert to SecurityFinding format
    const findings: SecurityFinding[] = rawFindings.map(
      (f: Record<string, unknown>, idx: number) => ({
        id: `finding_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 9)}`,
        category: (f.category as OwaspCategory) || category,
        title: (f.title as string) || 'Unknown vulnerability',
        severity: (f.severity as SecurityFinding['severity']) || 'medium',
        evidence: {
          file: (f.file as string) || 'unknown',
          lineRange: (f.lineRange as string) || '0-0',
          codeSnippet: f.codeSnippet as string | undefined,
        },
        explanation: (f.explanation as string) || '',
        recommendedFix: (f.recommendedFix as string) || '',
      })
    );

    console.log(`[auggie] Parsed ${findings.length} findings from response`);
    return findings;
  } catch (error) {
    console.error('[auggie] Failed to parse response as JSON:', error);
    console.log('[auggie] Raw response:', response.slice(0, 500));
    return [];
  }
}

/**
 * Analyze a repository for a specific OWASP category using Auggie
 *
 * This function:
 * 1. Fetches the OWASP prompt from Langfuse
 * 2. Initializes Auggie with the repo and report_vulnerability tool
 * 3. Lets Auggie orchestrate the analysis (codebase search + LLM reasoning)
 * 4. Collects findings from the report_vulnerability tool calls
 *
 * @returns Array of SecurityFinding objects
 */
export async function analyzeWithAuggie(
  options: AuggieAnalysisOptions
): Promise<SecurityFinding[]> {
  const { repoPath, category, scanId, model = 'sonnet4.5', credentials } = options;
  const categoryCode = getCategoryCode(category);

  return withAgent(
    `auggie_analyze_${categoryCode}`,
    async () => {
      return tracer.startActiveSpan(
        `auggie.analyze.${categoryCode}`,
        async (span) => {
          let client: Awaited<ReturnType<typeof Auggie.create>> | null = null;

          try {
            span.setAttributes({
              'scan.id': scanId,
              'owasp.category': category,
              'repo.path': repoPath,
              'auggie.model': model,
            });

            // Clear any previous findings
            clearFindings();

            // Get OWASP prompt from Langfuse
            const prompt = await getOwaspPrompt(categoryCode, {
              category,
              repo_path: repoPath,
            });

            span.setAttributes({
              'prompt.name': prompt.name,
              'prompt.version': prompt.version,
              'prompt.isFallback': prompt.isFallback,
            });

            // Credentials are validated at config load time and passed via options
            console.log('[auggie] Using credentials from validated config');
            console.log(`[auggie] API URL: ${credentials.apiUrl}`);

            console.log(
              `[auggie] Analyzing ${repoPath} for ${category} with ${model}`
            );

            // Initialize Auggie with the repository and credentials
            // Note: Custom tools temporarily disabled due to @mastra/mcp dependency issue
            // The SDK's MCP server requires @mastra/core/base which has version conflicts
            // TODO: Re-enable custom tools once SDK dependency issue is resolved
            client = await Auggie.create({
              workspaceRoot: repoPath,
              model,
              // Pass credentials from validated config
              apiKey: credentials.apiKey,
              apiUrl: credentials.apiUrl,
              // tools: {
              //   report_vulnerability: reportVulnerabilityTool,
              // },
            });

            // Build the analysis prompt - ask for structured JSON output
            const analysisPrompt = `${prompt.text}

Analyze this codebase for ${category} vulnerabilities.

For EACH vulnerability you find, include it in a JSON array with this structure:
{
  "findings": [
    {
      "category": "${category}",
      "title": "Brief title describing the vulnerability",
      "severity": "critical|high|medium|low|info",
      "file": "path/to/file.js",
      "lineRange": "45-52",
      "codeSnippet": "relevant code snippet",
      "explanation": "Why this is a vulnerability",
      "recommendedFix": "How to fix it"
    }
  ]
}

Be thorough but precise. Only report actual vulnerabilities with evidence.
Return ONLY the JSON array, no other text.`;

            // Let Auggie orchestrate the analysis
            const response = await client.prompt(analysisPrompt);

            console.log(`[auggie] Analysis complete. Response length: ${response.length}`);

            // Parse findings from JSON response
            const findings = parseAuggieResponse(response, category);

            span.setAttributes({
              'findings.count': findings.length,
            });
            span.setStatus({ code: SpanStatusCode.OK });

            return findings;
          } catch (error) {
            // Handle SDK-specific errors with proper categorization
            if (error instanceof APIError) {
              console.error(`[auggie] API Error (${error.status} ${error.statusText}):`, error.message);
              span.setAttributes({
                'error.type': 'APIError',
                'error.status': error.status,
                'error.statusText': error.statusText,
              });

              // Retry logic for transient failures (5xx errors)
              if (error.status >= 500 && error.status < 600) {
                console.log('[auggie] Transient API error detected, consider retry');
              }
            } else if (error instanceof BlobTooLargeError) {
              console.error('[auggie] File too large for indexing:', error.message);
              span.setAttributes({
                'error.type': 'BlobTooLargeError',
              });
            } else {
              console.error(`[auggie] Analysis failed for ${category}:`, error);
              span.setAttributes({
                'error.type': error instanceof Error ? error.constructor.name : 'unknown',
              });
            }

            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: error instanceof Error ? error.message : String(error),
            });
            span.recordException(error as Error);
            return [];
          } finally {
            // Always close the client
            if (client) {
              await client.close();
            }
            span.end();
          }
        }
      );
    },
    {
      input: {
        category,
        categoryCode,
        repoPath,
        scanId,
        model,
      },
      metadata: {
        toolType: 'auggie_analysis',
        owaspCategory: category,
      },
    }
  );
}
