import { startActiveObservation } from '@langfuse/tracing';
import type { GraphStatus, SecurityAnalysisState } from '../state';

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
  return startActiveObservation(
    'node.output',
    async (obs) => {
      // Capture input state for Langfuse tracing
      obs.update({
        input: {
          scanId: state.scanId,
          findingsCount: state.findings.length,
          errorsCount: state.errors.length,
          hasSummary: !!state.summary,
        },
        metadata: {
          nodeType: 'output',
          phase: 'finalization',
        },
      });

      const completedAt = new Date().toISOString();
      const hasErrors = state.errors.length > 0;
      const status: GraphStatus = hasErrors ? 'failed' : 'completed';

      console.log(`[output] Scan ${state.scanId} ${status}`);
      console.log(`[output] Total findings: ${state.findings.length}`);

      if (hasErrors) {
        console.log(`[output] Errors: ${state.errors.join(', ')}`);
      }

      const result = {
        status,
        completedAt,
      };

      // Capture output for Langfuse tracing
      obs.update({
        output: result,
        level: hasErrors ? 'WARNING' : 'DEFAULT',
      });

      return result;
    },
    { asType: 'span' }
  );
}
