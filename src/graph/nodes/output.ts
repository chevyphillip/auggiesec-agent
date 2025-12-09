import { tracer } from '../../instrumentation';
import type { SecurityAnalysisState, GraphStatus } from '../state';

/**
 * Output node - finalizes the scan and returns results
 *
 * This is the exit point of the graph. It:
 * 1. Records the scan completion time
 * 2. Sets final status
 * 3. Logs the completion
 */
export async function outputNode(
  state: SecurityAnalysisState
): Promise<Partial<SecurityAnalysisState>> {
  return tracer.startActiveSpan('node.output', async (span) => {
    try {
      const completedAt = new Date().toISOString();
      const hasErrors = state.errors.length > 0;
      const status: GraphStatus = hasErrors ? 'failed' : 'completed';

      span.setAttributes({
        'scan.id': state.scanId,
        'scan.status': status,
        'findings.count': state.findings.length,
        'errors.count': state.errors.length,
      });

      console.log(`[output] Scan ${state.scanId} ${status}`);
      console.log(`[output] Total findings: ${state.findings.length}`);

      if (hasErrors) {
        console.log(`[output] Errors: ${state.errors.join(', ')}`);
      }

      return {
        status,
        completedAt,
      };
    } finally {
      span.end();
    }
  });
}
