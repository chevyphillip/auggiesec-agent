import { tracer } from '../../instrumentation';
import type { SecurityAnalysisState } from '../state';

/**
 * Aggregate node - combines findings and generates summary
 *
 * This node:
 * 1. Aggregates all findings from analysis nodes
 * 2. Generates a human-readable summary
 * 3. Prepares the final output
 */
export async function aggregateNode(
  state: SecurityAnalysisState
): Promise<Partial<SecurityAnalysisState>> {
  return tracer.startActiveSpan('node.aggregate', async (span) => {
    try {
      span.setAttributes({
        'scan.id': state.scanId,
        'findings.count': state.findings.length,
        'categories.analyzed': state.analyzedCategories.length,
      });

      console.log(`[aggregate] Aggregating ${state.findings.length} findings`);

      // Group findings by severity
      const bySeverity = {
        critical: state.findings.filter((f) => f.severity === 'critical').length,
        high: state.findings.filter((f) => f.severity === 'high').length,
        medium: state.findings.filter((f) => f.severity === 'medium').length,
        low: state.findings.filter((f) => f.severity === 'low').length,
        info: state.findings.filter((f) => f.severity === 'info').length,
      };

      // Group findings by category
      const byCategory = state.findings.reduce(
        (acc, finding) => {
          acc[finding.category] = (acc[finding.category] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      // Generate summary
      const summaryParts: string[] = [
        `# Security Analysis Report`,
        ``,
        `**Scan ID:** ${state.scanId}`,
        `**Repository:** ${state.repoPath}`,
        `**Query:** ${state.userQuery}`,
        ``,
        `## Summary`,
        ``,
        `Total findings: ${state.findings.length}`,
        ``,
        `### By Severity`,
        `- Critical: ${bySeverity.critical}`,
        `- High: ${bySeverity.high}`,
        `- Medium: ${bySeverity.medium}`,
        `- Low: ${bySeverity.low}`,
        `- Info: ${bySeverity.info}`,
        ``,
        `### By OWASP Category`,
        ...Object.entries(byCategory).map(([cat, count]) => `- ${cat}: ${count}`),
        ``,
        `## Findings`,
        ``,
      ];

      // Add finding details
      for (const finding of state.findings) {
        summaryParts.push(
          `### ${finding.title}`,
          ``,
          `- **ID:** ${finding.id}`,
          `- **Category:** ${finding.category}`,
          `- **Severity:** ${finding.severity}`,
          `- **Location:** ${finding.evidence.file}:${finding.evidence.lineRange}`,
          ``,
          `**Explanation:** ${finding.explanation}`,
          ``,
          `**Recommended Fix:** ${finding.recommendedFix}`,
          ``,
          `---`,
          ``
        );
      }

      const summary = summaryParts.join('\n');

      console.log(`[aggregate] Generated summary (${summary.length} chars)`);

      return {
        summary,
      };
    } finally {
      span.end();
    }
  });
}
