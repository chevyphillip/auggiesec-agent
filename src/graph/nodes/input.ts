import { startActiveObservation } from '@langfuse/tracing';
import type { GraphStatus, SecurityAnalysisState } from '../state';

/**
 * Input node - initializes the scan and sets up tracking
 *
 * This is the entry point of the graph. It:
 * 1. Records the scan start time
 * 2. Sets status to 'running'
 * 3. Creates an observation for Langfuse with input/output capture
 */
export async function inputNode(
  state: SecurityAnalysisState
): Promise<Partial<SecurityAnalysisState>> {
  return startActiveObservation(
    'node.input',
    async (obs) => {
      // Capture input state for Langfuse tracing
      obs.update({
        input: {
          scanId: state.scanId,
          repoPath: state.repoPath,
          userQuery: state.userQuery,
          scopeFilter: state.scopeFilter ?? null,
        },
        metadata: {
          nodeType: 'input',
          phase: 'initialization',
        },
      });

      const startedAt = new Date().toISOString();
      const status: GraphStatus = 'running';

      console.log(`[input] Starting scan ${state.scanId}`);
      console.log(`[input] Repository: ${state.repoPath}`);
      console.log(`[input] Query: ${state.userQuery}`);

      const result = {
        status,
        startedAt,
      };

      // Capture output for Langfuse tracing
      obs.update({
        output: result,
      });

      return result;
    },
    { asType: 'span' }
  );
}
