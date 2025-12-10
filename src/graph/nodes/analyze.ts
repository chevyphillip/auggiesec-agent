/**
 * Auggie-based Security Analysis Node
 *
 * This module performs OWASP-based security analysis using the Auggie SDK.
 * Auggie orchestrates: codebase search, LLM reasoning, and tool execution.
 *
 * Key features:
 * - Uses Auggie SDK as the orchestrator (not just a tool)
 * - Auggie has built-in codebase indexing and search
 * - Uses OWASP prompts from Langfuse Prompt Management
 * - report_vulnerability tool collects structured findings
 * - Full observability via Langfuse
 */

import { startActiveObservation } from '@langfuse/tracing';
import { analyzeWithAuggie } from '../../tools/auggie-analysis';
import {
    type OwaspCategory,
    type SecurityAnalysisState,
    type SecurityFinding,
} from '../state';

/**
 * OWASP categories to analyze (prioritized for Node.js apps)
 * Can be expanded or made configurable
 */
const ANALYSIS_CATEGORIES: OwaspCategory[] = [
  'A03:2021-Injection',
  'A01:2021-Broken Access Control',
  'A07:2021-Identification and Authentication Failures',
  'A02:2021-Cryptographic Failures',
  'A06:2021-Vulnerable and Outdated Components',
];

/**
 * Analyze node - performs OWASP-based security analysis using Auggie SDK
 *
 * Auggie-based implementation (Phase 4):
 * - Fetches OWASP prompts from Langfuse Prompt Management
 * - Uses Auggie SDK to orchestrate analysis (codebase search + LLM reasoning)
 * - report_vulnerability tool collects structured findings
 * - Full observability via Langfuse agent observations
 */
export async function analyzeNode(
  state: SecurityAnalysisState
): Promise<Partial<SecurityAnalysisState>> {
  return startActiveObservation(
    'node.analyze',
    async (obs) => {
      // Capture input state for Langfuse tracing
      obs.update({
        input: {
          scanId: state.scanId,
          repoPath: state.repoPath,
          categories: ANALYSIS_CATEGORIES,
          targetsCount: state.targets.length,
        },
        metadata: {
          nodeType: 'analyze',
          phase: 'security_analysis',
          categoriesCount: ANALYSIS_CATEGORIES.length,
        },
      });

      console.log(`[analyze] Starting Auggie-based analysis of ${state.repoPath}`);
      console.log(`[analyze] Analyzing ${ANALYSIS_CATEGORIES.length} OWASP categories`);

      const allFindings: SecurityFinding[] = [];
      const analyzedCategories = new Set<OwaspCategory>();

      // Analyze each OWASP category using Auggie
      for (const category of ANALYSIS_CATEGORIES) {
        console.log(`[analyze] Analyzing: ${category}`);

        const categoryFindings = await analyzeWithAuggie({
          repoPath: state.repoPath,
          category,
          scanId: state.scanId,
          model: 'sonnet4.5',
          credentials: state.augmentCredentials,
        });

        allFindings.push(...categoryFindings);
        analyzedCategories.add(category);

        console.log(`[analyze] ${category}: ${categoryFindings.length} findings`);
      }

      // Deduplicate findings by title + file + line range
      const uniqueFindings = allFindings.filter(
        (finding, index, self) =>
          index ===
          self.findIndex(
            (f) =>
              f.title === finding.title &&
              f.evidence.file === finding.evidence.file &&
              f.evidence.lineRange === finding.evidence.lineRange
          )
      );

      // Sort by severity
      const severityOrder: Record<SecurityFinding['severity'], number> = {
        critical: 1,
        high: 2,
        medium: 3,
        low: 4,
        info: 5,
      };
      uniqueFindings.sort(
        (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
      );

      // Calculate severity breakdown
      const severityBreakdown = {
        critical: uniqueFindings.filter((f) => f.severity === 'critical').length,
        high: uniqueFindings.filter((f) => f.severity === 'high').length,
        medium: uniqueFindings.filter((f) => f.severity === 'medium').length,
        low: uniqueFindings.filter((f) => f.severity === 'low').length,
        info: uniqueFindings.filter((f) => f.severity === 'info').length,
      };

      console.log(`[analyze] Generated ${uniqueFindings.length} findings`);
      console.log(
        `[analyze] Breakdown: ${severityBreakdown.critical} critical, ` +
          `${severityBreakdown.high} high, ` +
          `${severityBreakdown.medium} medium, ` +
          `${severityBreakdown.low} low`
      );

      const result = {
        findings: uniqueFindings,
        analyzedCategories: Array.from(analyzedCategories),
      };

      // Capture output for Langfuse tracing
      obs.update({
        output: {
          findingsCount: uniqueFindings.length,
          severityBreakdown,
          analyzedCategories: result.analyzedCategories,
          // Include sample findings (not full list to avoid bloat)
          sampleFindings: uniqueFindings.slice(0, 5).map((f) => ({
            id: f.id,
            title: f.title,
            severity: f.severity,
            category: f.category,
          })),
        },
      });

      return result;
    },
    { asType: 'agent' }
  );
}
